const number=value=>Number.isFinite(Number(value))?Number(value).toLocaleString('pt-BR',{maximumFractionDigits:4}):String(value??'');
const signed=value=>Number(value)>0?'+'+number(value):number(value);
function matches(condition,values){return condition.split(':').every((rule,i)=>{
 if(!rule)return true;const value=values[i];if(value==null)return false;
 const expected=rule.slice(1);if(rule[0]==='=')return String(value)===expected;if(rule[0]==='!')return String(value)!==expected;
 if(rule[0]==='<')return Number(value)<Number(expected);if(rule[0]==='>')return Number(value)>Number(expected);return false;
});}
function translation(rules,values){return rules?.find(r=>matches(r.condition,values))?.translation}
export function labelMarkets(markets,event,dictionary={}){
 const home=event.competitors?.[0]?.name||'Time da casa',away=event.competitors?.[1]?.name||'Time visitante';
 for(const m of markets){
  const k=m.key;m.name=translation(dictionary.markets?.[k.marketType],['F',k.resultKind,k.period,k.subPeriod,null])||({2:'Resultado final',3:'Dupla chance',4:'Handicap',5:'Total'})[k.marketType]||'Mercado não traduzido ('+k.marketType+')';
  m.resultKindName=dictionary.tradingTypes?.[k.resultKind]?.translation||'Tipo de resultado '+k.resultKind;
  m.periodName=({0:'Partida completa',1:'1º tempo',2:'2º tempo',3:'Prorrogação',4:'Pênaltis',5:'1º tempo da prorrogação',6:'2º tempo da prorrogação'})[k.period]||'Período '+k.period;
  if(k.subPeriod!=null)m.periodName+=' · subperíodo '+k.subPeriod;
  for(const item of m.marketItems){
   const params=item.key.marketParameters||[];item.lineLabel=params.map(number).join(' / ')||'Sem linha';
   for(const o of item.outcomes){
    const type=o.key.type,unit=m.resultKindName.toLocaleLowerCase('pt-BR');
    const simple={0:'Casa ('+home+')',1:'Empate',3:'Fora ('+away+')',8:'Casa ou Empate (1X)',9:'Empate ou Fora (X2)',10:'Casa ou Fora (12)',11:'Casa ('+home+')',13:'Fora ('+away+')',14:'Sim',15:'Não'};
    if(type===4||type===5)o.name=(type===4?'Mais de ':'Menos de ')+number(params[0]??o.key.values?.[0])+' '+unit;
    else if((type===86||type===87)&&params.length&&Number.isFinite(Number(params[0]))){const line=Number(params[0])*(type===86?1:-1);o.name=(type===86?'Casa ('+home+')':'Fora ('+away+')')+' · handicap '+signed(line)}
    else if(simple[type])o.name=simple[type];
    else{
     const raw=translation(dictionary.outcomes?.[type],['F',k.resultKind,...params]);
     if(raw)o.name=raw.replaceAll('{Team1}','Casa ('+home+')').replaceAll('{Team2}','Fora ('+away+')').replace(/\{p(\d+)\}/g,(_,n)=>number(params[Number(n)-1])).replace(/\{s(\d+)\}/g,(_,n)=>String(o.key.values?.[Number(n)-1]??'')).replace(/#player(\d+)/g,'Jogador ID $1');
     else o.name='Seleção não traduzida ('+type+')'+(o.key.values?.length?' · '+o.key.values.join(' / '):'');
    }
    o.bookmakerId='tobetano';o.bookmakerName='Tobetano';
   }
  }
 }
 return markets;
}
