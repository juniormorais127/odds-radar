import assert from 'node:assert/strict';
import {eligibleLive,priceMovements} from './live-core.mjs';
assert(eligibleLive({sport:'F',stage:2,status:1}));assert(!eligibleLive({sport:'F',stage:1,status:0}));assert(!eligibleLive({sport:'F',stage:2,status:3}));assert(!eligibleLive({sport:'F',stage:2,status:1,isCybersport:true}));
const snapshot=(price,frozen=false,line='2.5')=>({observedAt:new Date().toISOString(),events:[{id:'game',event:{tradingStatus:1,scoreboard:{stage:10}},markets:[{key:{marketType:5,period:0},marketItems:[{key:{marketParameters:[line]},outcomes:[{key:{type:4},decimalOdds:price,isFrozen:frozen}]}]}]}]});
assert.equal(priceMovements(snapshot(2),snapshot(2)).length,0);assert.equal(priceMovements(snapshot(2),snapshot(2.6))[0].after,2.6);assert.equal(Math.round(priceMovements(snapshot(2),snapshot(2.6))[0].changePercent),30);
assert.equal(priceMovements(snapshot(2),snapshot(2.6,true)).length,0);assert.equal(priceMovements(snapshot(2),snapshot(2.6,false,'3.5'))[0].before,null);
console.log('Live: stage isolation, finished-game exclusion, suspension, line identity and movements OK');
