import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {parsePublicOdds} from './public-odds-parser.mjs';
const registry=JSON.parse(await fs.readFile('worker/house-registry.json','utf8'));
await fs.mkdir('collector-output',{recursive:true});
const browser=await chromium.launch({headless:true});
const sources=[];let index=0;
try{await Promise.all(Array.from({length:2},async()=>{while(index<registry.houses.length){
 const house=registry.houses[index++],context=await browser.newContext({locale:'pt-BR',timezoneId:'UTC'}),page=await context.newPage();
 const source={key:house.key,at:null,ok:false,records:[],method:'Navegador público sem login',url:house.url};
 try{
  // Use the public sportsbook origin exposed by the embedded page; no session or auth credentials.
  const url=house.key==='exclusive'?house.url.replace('https://exclusivebeteu.com/sports/betting/','https://sports2.exclusivebeteu.com/pt/'):house.url;
  const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  if(r&&r.status()>=400)throw Error('HTTP '+r.status()+' na página pública');
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){
   let text=await page.locator('body').innerText({timeout:4000});
   if(/just a moment|verify you are human|checking your browser|access denied/i.test(text))throw Error('Desafio ou restrição de acesso; coleta interrompida');
   if(house.key==='exclusive'){for(const frame of page.frames().slice(1)){try{text+='\n'+await frame.locator('body').innerText({timeout:1500})}catch{}}}
   const records=parsePublicOdds(house.key,text);
   if(records.length){source.records=records;source.ok=true;break}
   await page.waitForTimeout(2000);
  }
  if(!source.ok)throw Error('Mercado 1X2 do evento monitorado não disponível ou formato não reconhecido');
 }catch(e){source.error=String(e.message).slice(0,220)}finally{source.at=new Date().toISOString();sources.push(source);console.log(JSON.stringify(source));await context.close()}
}}))}finally{await browser.close()}
await fs.writeFile('collector-output/new-houses.json',JSON.stringify({at:new Date().toISOString(),scope:'Apenas eventos de exemplo cadastrados; não cobre todos os jogos das casas.',sources},null,2));
