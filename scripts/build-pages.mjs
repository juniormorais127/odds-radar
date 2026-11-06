import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import app from '../worker/index.js';
const output='pages-dist';
await fs.mkdir(output+'/data/catalog',{recursive:true});
const saved=new Map();
const env={BUCKET:{get:async key=>saved.has(key)?{body:saved.get(key),json:async()=>JSON.parse(saved.get(key))}:null,put:async(key,value)=>saved.set(key,value)}};
for(const [route,file] of [['odds','odds.json'],['monitor','monitor.json']]){
 const response=await app.fetch(new Request('https://localhost/api/'+route,{method:route==='monitor'?'POST':'GET'}),env);
 if(!response.ok)throw Error(`${route}: HTTP ${response.status}`);
 const data=await response.json();
 await fs.writeFile(output+'/data/'+file,JSON.stringify(data));
 console.log(route,data.at);
}
for(const name of await fs.readdir('worker/catalog-data')){
 const bytes=await fs.readFile('worker/catalog-data/'+name);
 await fs.writeFile(output+'/data/catalog/'+name.replace(/\.gz$/,''),name.endsWith('.gz')?gunzipSync(bytes):bytes);
}
await fs.copyFile('worker/archive.json.gz',output+'/coleta-completa.json.gz');
let html=await fs.readFile('worker/page.html','utf8');
html=html.replace("fetch('/api/odds')","fetch('data/odds.json?t='+Date.now())")
 .replace("fetch('/api/catalog?v=2',","fetch('data/catalog/index.json',")
 .replace("fetch('/api/catalog?sport='+encodeURIComponent(sport)+'&v=2',","fetch('data/catalog/'+encodeURIComponent(sport)+'.json',")
 .replace("fetch('/api/monitor',{method:force?'POST':'GET'})","fetch('data/monitor.json?t='+Date.now())")
 .replaceAll('href="/coleta-completa.json"','href="coleta-completa.json.gz"')
 .replace('Consultando as cinco fontes…','Carregando a última coleta publicada…')
 .replace(' · cache até 60 s',' · coleta publicada')
 .replaceAll('Verificar agora','Carregar última verificação');
html=html.replace('<body>','<body><div style="padding:10px 20px;background:#17263c;color:#dce6f4;font:14px system-ui">GitHub Pages · dados coletados pelo GitHub Actions a cada hora (sujeito a atrasos). Atualizar recarrega a última coleta; não consulta as casas em tempo real.</div>');
if(html.includes("fetch('/api/"))throw Error('Restou API dinâmica na página estática');
await fs.writeFile(output+'/index.html',html);
await fs.writeFile(output+'/.nojekyll','');
