import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import app from '../worker/index.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||4173), host='127.0.0.1';
const origin=`http://${host}:${port}`;
const dataDir=path.join(root,'data');
await fs.mkdir(dataDir,{recursive:true});
function location(key){
 if(!/^(catalog\/[a-z0-9-]+\.json(?:\.gz)?|monitor\/latest\.json)$/.test(key))throw Error('Chave inválida');
 return key.startsWith('catalog/')?path.join(root,'worker/catalog-data',key.slice(8)):path.join(dataDir,'monitor-latest.json');
}
const env={BUCKET:{
 async get(key){try{const body=await fs.readFile(location(key));return {body,json:async()=>JSON.parse(body.toString('utf8'))}}catch(e){if(e.code==='ENOENT')return null;throw e}},
 async put(key,value){if(key!=='monitor/latest.json')throw Error('Catálogo local somente leitura');const dest=location(key);await fs.writeFile(dest+'.tmp',typeof value==='string'?value:Buffer.from(value));await fs.rename(dest+'.tmp',dest)}
}};
http.createServer(async(req,res)=>{
 try{
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){res.writeHead(403);return res.end('Host inválido')}
  if(req.headers.origin&&![origin,`http://localhost:${port}`].includes(req.headers.origin)){res.writeHead(403);return res.end('Origem inválida')}
  const url=new URL(req.url,origin);
  if(!['GET','POST','HEAD'].includes(req.method)||url.pathname==='/api/catalog-upload'){res.writeHead(405);return res.end('Método não permitido')}
  const response=await app.fetch(new Request(url,{method:req.method}),env);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(new Date().toISOString(),e.message);res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Falha no servidor local'}))}
}).listen(port,host,()=>console.log(`Radar de Odds: ${origin}`));
async function monitor(){try{const r=await app.fetch(new Request(origin+'/api/monitor',{method:'POST'}),env);if(!r.ok)throw Error(`HTTP ${r.status}`);const d=await r.json();console.log(`${new Date().toISOString()} Monitor: ${d.alerts?.length||0} alertas; ${d.offers||0} eventos`)}catch(e){console.error('Monitor:',e.message)}}
if(process.env.MONITOR_ENABLED!=='0'){void monitor();setInterval(monitor,3600000)}
