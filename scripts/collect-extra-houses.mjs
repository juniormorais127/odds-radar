import fs from 'node:fs/promises';
import {adapters} from './house-adapters.mjs';
await fs.mkdir('collector-output',{recursive:true});
const sources=[];
await Promise.all(['grana','exclusive'].map(async key=>{try{const result=await adapters[key]();sources.push({key,ok:true,at:new Date().toISOString(),...result})}catch(e){sources.push({key,ok:false,at:new Date().toISOString(),games:[],partial:true,error:e.message})}}));
await fs.writeFile('collector-output/extra-houses.json',JSON.stringify({at:new Date().toISOString(),sources}));
let collection={sources:[]};try{collection=JSON.parse(await fs.readFile('collector-output/new-houses.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
for(const s of sources){collection.sources=collection.sources.filter(r=>r.key!==s.key);collection.sources.push({...s,records:s.games.map(g=>({...g,house:s.key,market:'Resultado final · tempo regulamentar'})),url:s.key==='grana'?'https://granawin-go.com/br/prematch/football':'https://sports2.exclusivebeteu.com/pt',method:'Coletor específico por casa, sem login'})}
collection.at=new Date().toISOString();collection.scope='Coleta pública por fonte; Granawin paginada, ExclusiveBet por ligas do menu, demais fontes com limites próprios.';
await fs.writeFile('collector-output/new-houses.json',JSON.stringify(collection));
console.log(JSON.stringify(sources.map(s=>({key:s.key,ok:s.ok,games:s.games.length,error:s.error}))));
