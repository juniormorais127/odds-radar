import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import app from '../worker/index.js';
import {withRegisteredHouses} from './registered-houses.mjs';
const output='pages-dist';
await fs.mkdir(output+'/data/catalog',{recursive:true});
try{await fs.copyFile('collector-output/new-houses.json',output+'/data/new-houses.json')}catch(e){if(e.code!=='ENOENT')throw e}
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
let html=withRegisteredHouses(await fs.readFile('worker/page.html','utf8'));
html=html.replace("fetch('/api/odds')","fetch('data/odds.json?t='+Date.now())")
 .replace("fetch('/api/catalog?v=2',","fetch('data/catalog/index.json',")
 .replace("fetch('/api/catalog?sport='+encodeURIComponent(sport)+'&v=2',","fetch('data/catalog/'+encodeURIComponent(sport)+'.json',")
 .replace("fetch('/api/monitor',{method:force?'POST':'GET'})","fetch('data/monitor.json?t='+Date.now())")
 .replaceAll('href="/coleta-completa.json"','href="coleta-completa.json.gz"')
 .replace('Consultando as cinco fontes…','Carregando a última coleta publicada…')
 .replace(' · cache até 60 s',' · coleta publicada')
 .replaceAll('Verificar agora','Carregar última verificação')
 .replace('id="refresh">Atualizar odds</button>','id="refresh">Recarregar dados publicados</button><a href="https://github.com/juniormorais127/odds-radar/actions/workflows/pages.yml" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 14px;color:#dce6f4">Coletar novas odds no GitHub ↗</a>')
 .replace('Coleta antiga ou indisponível. Atualize as odds para calcular oportunidades atuais.','Coleta antiga ou indisponível. Use “Coletar novas odds no GitHub”, clique em “Run workflow” e aguarde a publicação. Depois recarregue os dados aqui.')
 .replace('Atualize para procurar oportunidades','Inicie uma nova coleta no GitHub')
 .replace('A atualização é manual, com cache de até 60 segundos.','Nesta versão GitHub Pages, uma nova coleta precisa ser executada pelo GitHub Actions. O botão Recarregar dados publicados apenas lê o último arquivo disponível.');
html=html.replace('<body>','<body><div style="padding:10px 20px;background:#17263c;color:#dce6f4;font:14px system-ui">GitHub Pages · coleta automática a cada hora, sujeita a atrasos. Para coletar agora: abra “Coletar novas odds no GitHub” → “Run workflow” → botão verde “Run workflow”. É preciso estar conectado à conta dona do repositório. Quando a execução terminar, clique em “Recarregar dados publicados”.</div>');
if(html.includes("fetch('/api/"))throw Error('Restou API dinâmica na página estática');
await fs.writeFile(output+'/index.html',html);
await fs.writeFile(output+'/.nojekyll','');
