let catalogIndex=null,catalogData=null,catalogPage=0,catalogMatches=[],monitorBusy=false;
let catalogRequest=0,catalogController=null,catalogIndexLoading=false,catalogPending=false,catalogFilterSignature='',catalogSearchTimer;
async function catalogJson(response){
 if(!response.ok)throw Error('Não foi possível consultar o catálogo (HTTP '+response.status+').');
 let bytes=new Uint8Array(await response.arrayBuffer());
 // Older edge responses may have decoded only the outer compression layer.
 for(let depth=0;bytes[0]===0x1f&&bytes[1]===0x8b&&depth<2;depth++){
  if(typeof DecompressionStream==='undefined')throw Error('Atualize seu navegador para abrir o catálogo compactado.');
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  bytes=new Uint8Array(await new Response(stream).arrayBuffer());
 }
 try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw Error('O catálogo recebido está inválido. Tente carregar novamente.')}
}
function catalogDate(value){return Number.isFinite(Date.parse(value))?date(value):'Horário não informado'}
function catalogBusy(busy){catalogPending=busy;$('catalogPrevious').disabled=true;$('catalogNext').disabled=true;$('catalogPage').textContent=busy?'Carregando…':'';$('catalogRetry').hidden=true}
function catalogFailure(error){$('catalogRows').innerHTML='<div class="empty"><h3>Não foi possível carregar este esporte</h3><p>'+esc(error.message)+'</p></div>';$('catalogRetry').hidden=false;catalogBusy(false);$('catalogRetry').hidden=false}
async function loadCatalogIndex(){
 if(catalogIndexLoading)return;catalogIndexLoading=true;catalogBusy(true);$('catalogSport').disabled=true;
 try{
  const data=await catalogJson(await fetch('/api/catalog?v=2',{cache:'no-cache'}));
  if(!Array.isArray(data.sports))throw Error('A lista de esportes está inválida.');
  const sports=data.sports.filter(s=>typeof s.id==='string'&&/^[a-z0-9-]+$/.test(s.id)&&typeof s.name==='string');
  if(!sports.length)throw Error('Nenhum esporte disponível no catálogo.');
  catalogIndex={...data,sports};$('catalogSport').innerHTML=sports.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' ('+Number(s.odds||0).toLocaleString('pt-BR')+' odds)</option>').join('');
  $('catalogInfo').textContent='Coleta encerrada em '+catalogDate(data.at)+' · '+sports.length+' modalidades/categorias · dados históricos e cobertura parcial. Códigos de mercados Melbet ainda não traduzidos.';
  $('catalogSport').disabled=false;await loadCatalogSport();
 }catch(error){catalogIndex=null;catalogData=null;$('catalogSport').innerHTML='<option value="">Lista indisponível</option>';$('catalogInfo').textContent='A lista de esportes não foi carregada.';catalogFailure(error)}finally{catalogIndexLoading=false}
}
async function loadCatalogSport(){
 const sport=$('catalogSport').value;if(!sport)return;
 const request=++catalogRequest;catalogController?.abort();catalogController=new AbortController();
 catalogData=null;catalogMatches=[];catalogFilterSignature='';catalogPage=0;catalogBusy(true);$('catalogRows').textContent='Carregando esporte…';
 try{
  const data=await catalogJson(await fetch('/api/catalog?sport='+encodeURIComponent(sport)+'&v=2',{signal:catalogController.signal,cache:'no-cache'}));
  if(request!==catalogRequest)return;
  if(!Array.isArray(data.events))throw Error('Os eventos deste esporte estão inválidos.');
  catalogData=data;const previous=$('catalogSource').value;
  const sources=[...new Set(data.events.map(e=>e.source).filter(s=>typeof s==='string'))].sort();
  $('catalogSource').innerHTML='<option value="">Todas as casas disponíveis</option>'+sources.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join('');
  $('catalogSource').value=sources.includes(previous)?previous:'';catalogBusy(false);renderCatalog();
 }catch(error){if(request!==catalogRequest||error.name==='AbortError')return;catalogData=null;catalogMatches=[];catalogFailure(error)}
}
function renderCatalog(){
 if(!catalogData||catalogPending)return;
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const q=normalize($('catalogQuery').value.trim()),source=$('catalogSource').value;
 const signature=JSON.stringify([catalogRequest,q,source]);
 if(catalogFilterSignature!==signature){
  catalogMatches=[];
  for(const e of catalogData.events){
   if(!e||typeof e!=='object'||(source&&e.source!==source)||!e.markets||typeof e.markets!=='object')continue;
   for(const [market,outcomes] of Object.entries(e.markets)){
    if(!Array.isArray(outcomes))continue;const matchesEvent=!q||normalize(e.event+' '+e.league+' '+market).includes(q);
    for(const o of outcomes)if(Array.isArray(o)&&Number.isFinite(o[1])&&(matchesEvent||normalize(o[0]).includes(q)))catalogMatches.push({e,market,o});
   }
  }
  catalogFilterSignature=signature;
 }
 const pages=Math.max(1,Math.ceil(catalogMatches.length/100));catalogPage=Math.max(0,Math.min(catalogPage,pages-1));
 const rows=catalogMatches.slice(catalogPage*100,(catalogPage+1)*100);
 $('catalogRows').innerHTML=rows.length?'<div class="scroll"><table><thead><tr><th>Fonte / evento</th><th>Mercado</th><th>Seleção</th><th>Odd coletada</th><th>Coleta</th></tr></thead><tbody>'+rows.map(({e,market,o})=>'<tr><td class="game">'+esc(e.event)+'<span class="sub">'+esc(e.source)+' · '+esc(e.time)+' · '+esc(e.league)+'</span></td><td>'+esc(market)+'</td><td>'+esc(o[0])+'</td><td class="num">'+fmt(o[1])+(o[1]<=1?'<span class="sub">Inválida para cálculo</span>':o[2]?'<span class="sub">Suspensa</span>':'')+'</td><td>'+catalogDate(e.at)+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty"><h3>Nenhuma cotação corresponde aos filtros</h3><p>Altere a busca ou selecione outra casa.</p></div>';
 $('catalogPage').textContent=(catalogMatches.length?'Página '+(catalogPage+1)+' de '+pages+' · ':'')+catalogMatches.length.toLocaleString('pt-BR')+' cotações';
 $('catalogPrevious').disabled=catalogPage===0;$('catalogNext').disabled=catalogPage+1>=pages;
}
$('catalogSport').onchange=loadCatalogSport;
$('catalogSource').onchange=()=>{catalogPage=0;renderCatalog()};
$('catalogQuery').oninput=()=>{clearTimeout(catalogSearchTimer);catalogSearchTimer=setTimeout(()=>{catalogPage=0;renderCatalog()},200)};
$('catalogPrevious').onclick=()=>{catalogPage--;renderCatalog()};$('catalogNext').onclick=()=>{catalogPage++;renderCatalog()};
$('catalogRetry').onclick=()=>catalogIndex?loadCatalogSport():loadCatalogIndex();
