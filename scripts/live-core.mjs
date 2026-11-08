export const eligibleLive=e=>e?.sport==='F'&&e.stage===2&&[0,1,2].includes(e.status)&&!e.isCybersport;
export function priceRows(snapshot){
 const prices=new Map();
 for(const game of snapshot.events||[])for(const market of game.markets||[])for(const item of market.marketItems||[])for(const o of item.outcomes||[]){
  if(o.isFrozen||game.event.tradingStatus!==1||!(o.decimalOdds>1))continue;
  const key=JSON.stringify([game.id,market.key,item.key,o.key]);prices.set(key,{eventId:game.id,market:market.key,line:item.key,selection:o.key,price:o.decimalOdds,scoreboard:game.event.scoreboard});
 }
 return prices;
}
export function priceMovements(before,after){const old=priceRows(before),current=priceRows(after),changes=[];for(const [key,row] of current){const prior=old.get(key);if(!prior||prior.price!==row.price)changes.push({...row,at:after.observedAt,before:prior?.price??null,after:row.price,changePercent:prior?(row.price/prior.price-1)*100:null});}return changes;}
