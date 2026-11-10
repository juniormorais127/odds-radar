export function marketAnomalies(doc,mode,now=Date.now()){
 const e=doc.event,age=now-Date.parse(doc.observedAt);if(!e||e.sport!=='F'||e.isCybersport||e.tradingStatus!==1||age<0||age>(mode==='live'?40000:300000)||doc.lifecycle)return [];
 if(mode==='live'?e.stage!==2:e.stage!==1||e.startTime*1000<=now)return [];
 const seconds=e.scoreboard?.timer?.currentTimeSeconds,stage=e.scoreboard?.stage;
 const activePeriod=p=>p===0||(p===1&&mode==='prematch')||(p===1&&[1,10].includes(stage)&&Number.isFinite(seconds)&&seconds<2700)||(p===2&&(mode==='prematch'||[1,2,3,10].includes(stage)));
 const markets=(doc.markets||[]).filter(m=>!m.isRemoved&&m.key.subPeriod==null&&m.key.layout==null&&activePeriod(m.key.period));
 const signals=[],house=doc.bookmakerId||'tobetano';
 const quote=(m,i,o)=>({bookmakerId:house,bookmakerName:doc.bookmakerName||'Tobetano',marketName:[m.name,m.resultKindName,m.periodName,i.lineLabel].filter(Boolean).join(' · '),selectionLabel:o.name||'Seleção '+o.key.type,selectionName:o.name,decimalOdds:o.decimalOdds,observedAt:doc.observedAt,sourceUrl:doc.sourceUrl||null});
 const open=o=>!o.isFrozen&&!o.isRemoved&&Number.isFinite(o.decimalOdds)&&o.decimalOdds>1;
 const emit=(type,key,picks,note,severity)=>signals.push({id:mode+'|'+type+'|'+doc.id+'|'+key,mode,type,eventId:doc.id,event:e.name,bookmakerId:house,picks,observedAt:doc.observedAt,scoreboard:e.scoreboard,stageName:e.stageName,note,severity});
 for(const m of markets.filter(m=>m.key.marketType===5)){
  const totals=(m.marketItems||[]).filter(i=>!i.isRemoved&&i.key.marketParameters.length===1&&Number.isFinite(Number(i.key.marketParameters[0]))).map(i=>({i,line:Number(i.key.marketParameters[0])})).sort((a,b)=>a.line-b.line);
  for(const {i,line} of totals){const under=i.outcomes.find(o=>o.key.type===5&&open(o));
   if(m.key.resultKind===4&&m.key.period===0&&line>0&&line<=10&&under?.decimalOdds>=3)emit('corners_high_review',m.key.period+'|'+line,[quote(m,i,under)],'Odd alta de menos escanteios: exige conferir linha, contagem atual, tempo restante e regras. O preço alto sozinho não indica erro nem chance maior de ganhar.','review');
  }
  // Half-unit lines only: avoids mixing pushes and quarter-line split settlements.
  const half=totals.filter(t=>Math.abs(t.line%1)===0.5);
  for(let n=1;n<half.length;n++){const lower=half[n-1],higher=half[n];for(const type of [4,5]){
   const a=lower.i.outcomes.find(o=>o.key.type===type&&open(o)),b=higher.i.outcomes.find(o=>o.key.type===type&&open(o));if(!a||!b)continue;
   const broad=type===5?{i:higher.i,o:b}:{i:lower.i,o:a},narrow=type===5?{i:lower.i,o:a}:{i:higher.i,o:b};
   if(broad.o.decimalOdds>narrow.o.decimalOdds*1.10)emit('market_price_inversion',m.key.resultKind+'|'+m.key.period+'|'+type+'|'+lower.line+'|'+higher.line,[quote(m,broad.i,broad.o),quote(m,narrow.i,narrow.o)],'Possível inversão entre linhas: a seleção que cobre mais resultados está pagando mais de 10% acima da seleção mais restrita, no mesmo mercado e período. Conferir regras e disponibilidade na casa.','inconsistency');
  }}
 }
 for(const m of markets.filter(m=>m.key.marketType===2&&m.key.resultKind===1)){
  const dc=markets.find(d=>d.key.marketType===3&&d.key.resultKind===1&&d.key.period===m.key.period);if(!dc)continue;
  const win=m.marketItems.filter(i=>!i.key.marketParameters.length),doubles=dc.marketItems.filter(i=>!i.key.marketParameters.length);if(win.length!==1||doubles.length!==1)continue;
  for(const [single,broad] of [[0,8],[3,9],[0,10],[3,10]]){const a=win[0].outcomes.find(o=>o.key.type===single&&open(o)),b=doubles[0].outcomes.find(o=>o.key.type===broad&&open(o));if(a&&b&&b.decimalOdds>a.decimalOdds*1.10)emit('market_price_inversion','double|'+m.key.period+'|'+single+'|'+broad,[quote(dc,doubles[0],b),quote(m,win[0],a)],'Possível inversão: dupla chance paga mais que a vitória simples que ela inclui, no mesmo período. Conferir se as regras e as seleções correspondem.','inconsistency')}
 }
 return signals;
}
