import assert from 'node:assert/strict';
import {analyzeLive,analyzePrematch,favouriteSignal} from './opportunities.mjs';
const now=Date.now(),at=new Date(now).toISOString();
const market=(period,prices)=>({key:{resultKind:1,marketType:2,period},marketItems:[{key:{marketParameters:[]},outcomes:[0,1,3].map((type,i)=>({key:{type},decimalOdds:prices[i],isFrozen:false}))}]});
const game={id:'game',observedAt:at,event:{sport:'F',name:'A - B',stage:2,status:1,tradingStatus:1,startTime:(now-1000000)/1000,competitors:[{name:'A'},{name:'B'}],scoreboard:{timer:{currentTimeSeconds:1000}}},markets:[market(0,[1.2,6,12]),market(1,[3.5,2,5])]};
assert.equal(analyzeLive({events:[game]},now).length,1);
assert.equal(analyzeLive({events:[{...game,observedAt:new Date(now-41000).toISOString()}]},now).length,0);
assert.equal(favouriteSignal({...game,event:{...game.event,scoreboard:{timer:{currentTimeSeconds:2800}}}},'live',now),null);
const frozen=structuredClone(game);frozen.markets[1].marketItems[0].outcomes[0].isFrozen=true;assert.equal(favouriteSignal(frozen,'live',now),null);
const subperiod=structuredClone(game);subperiod.markets[1].key.subPeriod=15;assert.equal(favouriteSignal(subperiod,'live',now),null);
assert(favouriteSignal({...game,event:{...game.event,stage:1,status:0,startTime:(now+86400000)/1000}},'prematch',now));
const event={id:'e',sport:'football',home:'A',away:'B',startsAt:new Date(now+86400000).toISOString()};
const quotes=['home','draw','away'].map((selection,i)=>({eventId:'e',marketId:'ft_1x2',selection,selectionName:selection,bookmakerId:['jogos','melbet','esporte'][i],decimalOdds:[4,4.31,2.1][i],method:'automatic',freshness:'current',observedAt:at}));
const signals=analyzePrematch({events:[event],quotes},now);assert.equal(signals.filter(s=>s.type==='surebet_candidate').length,1);assert(Math.abs(signals[0].profitPercent-4.36136)<0.00001);
assert.equal(analyzePrematch({events:[event],quotes:quotes.map(q=>({...q,method:'browser_manual'}))},now).length,0);
assert.equal(analyzePrematch({events:[event],quotes:quotes.map(q=>({...q,observedAt:new Date(now-301000).toISOString()}))},now).length,0);
console.log('Signals: fast live analysis, pre/live isolation, stale prices, settled periods, suspended odds and surebet calculation OK');

const boundary=structuredClone(game);boundary.markets[0].marketItems[0].outcomes[0].decimalOdds=1.3;boundary.markets[1].marketItems[0].outcomes[0].decimalOdds=2.5;assert(favouriteSignal(boundary,'live',now));boundary.markets[0].marketItems[0].outcomes[0].decimalOdds=1.31;assert.equal(favouriteSignal(boundary,'live',now),null);boundary.markets[0].marketItems[0].outcomes[0].decimalOdds=1.3;boundary.markets[1].marketItems[0].outcomes[0].decimalOdds=2.49;assert.equal(favouriteSignal(boundary,'live',now),null);boundary.markets[1].marketItems[0].outcomes[0].decimalOdds=6;boundary.event.scoreboard.stage=3;assert.equal(favouriteSignal(boundary,'live',now),null);
