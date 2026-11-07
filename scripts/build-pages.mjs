import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import app from '../worker/index.js';
import {withRegisteredHouses} from './registered-houses.mjs';
import {mergeBrowserQuotes,mergeAutomaticQuotes} from './browser-quotes.mjs';
import {writeFootballApi} from './football-api.mjs';
import {updateHistory} from './odds-history.mjs';
import {publishTobetano,mergeTobetano} from './tobetano-integration.mjs';
const output='pages-dist';
const tobetano=await publishTobetano(output);
await fs.mkdir(output+'/data/catalog',{recursive:true});
try{await fs.copyFile('collector-output/new-houses.json',output+'/data/new-houses.json')}catch(e){if(e.code!=='ENOENT')throw e}
const saved=new Map();
let previousHistory;
try{previousHistory=JSON.parse(await fs.readFile('history-state/history.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
let newHouses;try{newHouses=JSON.parse(await fs.readFile('collector-output/new-houses.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const env={BUCKET:{get:async key=>saved.has(key)?{body:saved.get(key),json:async()=>JSON.parse(saved.get(key))}:null,put:async(key,value)=>saved.set(key,value)}};
for(const [route,file] of [['odds','odds.json'],['monitor','monitor.json']]){
 const response=await app.fetch(new Request('https://localhost/api/'+route,{method:route==='monitor'?'POST':'GET'}),env);
 if(!response.ok)throw Error(`${route}: HTTP ${response.status}`);
 const data=await response.json();
 if(route==='odds'){
  mergeBrowserQuotes(data);mergeAutomaticQuotes(data,newHouses);
  mergeTobetano(data,tobetano);
  const api=await writeFootballApi(fs,output,data,newHouses);
  const history=updateHistory(previousHistory,api);
  await fs.mkdir('history-state',{recursive:true});
  await fs.writeFile('history-state/history.json',JSON.stringify(history));
  await fs.writeFile(output+'/api/v1/history.json',JSON.stringify(history));
  await fs.writeFile(output+'/api/v1/movement-alerts.json',JSON.stringify({generatedAt:history.generatedAt,thresholdPercent:history.thresholdPercent,alerts:history.alerts}));
 }
 await fs.writeFile(output+'/data/'+file,JSON.stringify(data));
 console.log(route,data.at);
}
for(const name of await fs.readdir('worker/catalog-data')){
 const bytes=await fs.readFile('worker/catalog-data/'+name);
 await fs.writeFile(output+'/data/catalog/'+name.replace(/\.gz$/,''),name.endsWith('.gz')?gunzipSync(bytes):bytes);
}
await fs.copyFile('worker/archive.json.gz',output+'/coleta-completa.json.gz');
let html=withRegisteredHouses(await fs.readFile('worker/page.html','utf8'));
html=html.replace("fortune:'FortuneJack'","fortune:'FortuneJack',tobetano:'Tobetano'")
 .replace('<th>FortuneJack</th>','<th>FortuneJack</th><th>Tobetano</th>')
 .replace('<option value="fortune">FortuneJack</option>','<option value="fortune">FortuneJack</option><option value="tobetano">Tobetano</option>');
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
html=html.replace('<body>','<body><div style="padding:10px 20px;background:#17263c;color:#dce6f4;font:14px system-ui">GitHub Pages · coleta automática a cada 30 minutos, sujeita a atrasos. Para coletar agora: abra “Coletar novas odds no GitHub” → “Run workflow” → botão verde “Run workflow”. É preciso estar conectado à conta dona do repositório. Quando a execução terminar, clique em “Recarregar dados publicados”.</div>');
if(html.includes("fetch('/api/"))throw Error('Restou API dinâmica na página estática');
await fs.copyFile('API.md',output+'/API.md');
await fs.writeFile(output+'/api.html','<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>API de futebol · Odds Radar</title><body style="background:#101827;color:#e2e8f0;font:16px system-ui;max-width:850px;margin:40px auto;padding:20px"><h1>API de futebol</h1><p>Snapshots JSON organizados por jogo, casa, mercado e seleção. Coleta programada a cada 30 minutos, sujeita a atrasos.</p><p>Cobertura parcial de resultado final. Primeiro tempo e outros mercados ainda não integrados. Consulte os horários de cada cotação e as falhas por casa.</p><ul><li><a style="color:#7dd3fc" href="api/v1/index.json">Índice e cobertura</a></li><li><a style="color:#7dd3fc" href="api/v1/football.json">Dados completos</a></li><li><a style="color:#7dd3fc" href="api/v1/bookmakers.json">Casas e situação da coleta</a></li><li><a style="color:#7dd3fc" href="api/v1/events.json">Jogos</a></li><li><a style="color:#7dd3fc" href="api/v1/quotes.json">Cotações</a></li><li><a style="color:#7dd3fc" href="API.md">Documentação e exemplo de consumo</a></li></ul><a style="color:#7dd3fc" href="./">Voltar ao painel</a></body></html>');
html=html.replace('<body>','<body><a href="api.html" style="display:block;padding:10px 20px;color:#7dd3fc;background:#101827">API de futebol · dados organizados e documentação ↗</a>');
await fs.writeFile(output+'/index.html',html);
await fs.copyFile('worker/history.js',output+'/history.js');
await fs.copyFile('worker/tobetano.js',output+'/tobetano.js');
let apiPage=await fs.readFile(output+'/api.html','utf8');
apiPage=apiPage.replace('</ul>','<li><a style="color:#7dd3fc" href="api/v1/tobetano/index.json">Tobetano · todos os mercados de futebol pré-jogo</a></li></ul>');
await fs.writeFile(output+'/api.html',apiPage);
html=html.replace('</body>','<script src="tobetano.js?v=1"></script></body>');
html=html.replace('</body>','<script src="history.js?v=2"></script></body>');
await fs.writeFile(output+'/index.html',html);
await fs.writeFile(output+'/.nojekyll','');
