import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const origin='https://apostacerta.bet';
async function get(url,json=true){const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);return json?r.json():r.text()}
export async function apostaConfig(){
 const config=await get(origin+'/api/betby/config');
 if(!/^\d+$/.test(config.brandId||''))throw Error('Identificador público não encontrado');
 const library=new URL(config.libraryUrl);if(library.protocol!=='https:'||!library.hostname.endsWith('.sptpub.com'))throw Error('Biblioteca fora do fornecedor esperado');
 const source=await get(library.href,false),api=source.match(/https:\/\/api-[a-z0-9-]+\.sptpub\.com/)?.[0];if(!api)throw Error('API pública não identificada');
 return {brandId:config.brandId,api,language:'pt-BR'};
}
export async function apostaSnapshot(config,mode){
 if(!['live','prematch'].includes(mode))throw Error('Modo inválido');
 const root=config.api+'/api/v4/'+mode+'/brand/'+config.brandId+'/'+config.language+'/';
 for(let attempt=0;attempt<2;attempt++){
  const meta=await get(root+'0'),versions=[...new Set([...(meta.top_events_versions||[]),...(meta.rest_events_versions||[])])];
  if(!versions.length)throw Error('Resposta sem versões de snapshot');
  const pages=[];let next=0;await Promise.all(Array.from({length:3},async()=>{while(next<versions.length)pages.push(await get(root+versions[next++]))}));
  if(pages.some(p=>!p.events)){if(attempt===0)continue;throw Error('Snapshot expirou antes da leitura completa')}
  const data={};for(const p of pages)for(const key of ['sports','categories','tournaments','events'])data[key]={...data[key],...p[key]};
  return {data,observedAt:new Date().toISOString(),sourceUrl:root+'0',mode};
 }
}
export function parseApostaFootball(snapshot,now=Date.now()){
 const {data,mode,observedAt}=snapshot,events=[],quotes=[];
 for(const [id,e] of Object.entries(data.events||{})){
  const d=e.desc,state=e.state;if(d?.sport!=='1'||d.type!=='match'||d.competitors?.length!==2||!Number.isFinite(d.scheduled))continue;
  if(mode==='prematch'?(state?.status!==0||d.scheduled*1000<=now):state?.status!==1)continue;
  const category=data.categories?.[d.category];if(/esoccer|efootball|efutebol|virtual|simulated/i.test([category?.slug,category?.name,category?.country_code].join(' ')))continue;
  const [home,away]=d.competitors;if(!home.name||!away.name)continue;
  const result=e.markets?.['1']?.[''],values=['1','2','3'].map(key=>result?.[key]),odds=values.map(o=>Number(o?.k));
  const event={id,bookmakerId:'apostacerta',bookmakerName:'Aposta Certa',mode,home:home.name,away:away.name,startsAt:new Date(d.scheduled*1000).toISOString(),league:data.tournaments?.[d.tournament]?.name||null,observedAt,score:mode==='live'?{home:e.score?.home_score??null,away:e.score?.away_score??null}:null,clock:mode==='live'?state.clock?.match_time||null:null,rawMarkets:e.markets};events.push(event);
  if(!odds.every(o=>Number.isFinite(o)&&o>1)||values.some(o=>o.b))continue;
  for(const [i,selection] of ['home','draw','away'].entries())quotes.push({eventId:id,bookmakerId:'apostacerta',bookmakerName:'Aposta Certa',mode,marketId:'ft_1x2',period:'full_time',selection,selectionLabel:i===0?'Casa ('+home.name+')':i===1?'Empate':'Fora ('+away.name+')',decimalOdds:odds[i],observedAt,sourceUrl:null});
 }
 return {generatedAt:observedAt,bookmakerId:'apostacerta',bookmakerName:'Aposta Certa',mode,sourceApi:snapshot.sourceUrl,coverage:{sport:'football',normalizedMarkets:['ft_1x2'],complete:false,note:'Outros mercados preservados em rawMarkets por código original, sem interpretação não validada. Link direto de partida ainda não validado.'},events,quotes};
}
async function main(){const config=await apostaConfig(),output='collector-output/apostacerta';await fs.mkdir(output,{recursive:true});for(const mode of ['prematch','live']){const snapshot=await apostaSnapshot(config,mode),data=parseApostaFootball(snapshot);await fs.writeFile(output+'/'+mode+'.json',JSON.stringify(data));console.log(JSON.stringify({house:'Aposta Certa',mode,observedAt:data.generatedAt,events:data.events.length,quotes:data.quotes.length,file:output+'/'+mode+'.json',api:data.sourceApi,sample:data.events.slice(0,1).map(e=>({home:e.home,away:e.away,score:e.score,clock:e.clock,odds:data.quotes.filter(q=>q.eventId===e.id).map(q=>({selection:q.selectionLabel,odd:q.decimalOdds}))}))}))}}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])main().catch(e=>{console.error('Aposta Certa: '+e.message);process.exitCode=1});
