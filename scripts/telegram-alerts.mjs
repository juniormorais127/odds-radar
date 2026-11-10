import fs from 'node:fs/promises';
import {specificEventUrl,hasTelegramEventLinks} from './event-links.mjs';
const names={surebet_candidate:'POSSÍVEL SUREBET',favourite_first_half:'FAVORITO / PRIMEIRO TEMPO',market_price_inversion:'POSSÍVEL INVERSÃO DE PREÇOS',corners_high_review:'ESCANTEIOS · APENAS PARA ANÁLISE',price_gap:'DIFERENÇA ENTRE CASAS',started_as_prematch:'JOGO INICIADO / LISTADO COMO PRÉ-JOGO',finished_as_prematch:'JOGO ENCERRADO / LISTADO COMO PRÉ-JOGO'};
const link=(lines,url,label='Link da partida')=>{const direct=specificEventUrl(url);lines.push(direct?label+': '+direct:'Link específico indisponível nesta fonte')};
const stamp=at=>at?new Date(at).toLocaleString('pt-BR',{timeZone:'America/Fortaleza'}):'não informado';
export function telegramText(s){
 const lines=[names[s.type]||'SINAL DE PREÇO',s.event,s.mode==='live'?'AO VIVO':s.mode==='prematch'?'PRÉ-JOGO':'ALERTA DE STATUS'];
 const score=s.reference?.score||s.scoreboard?.scores?.find(p=>p.periodScoreType===1&&p.period===1&&!p.isRemoved)?.score;
 if(score)lines.push('Placar informado: '+score);
 const seconds=s.reference?.seconds??s.scoreboard?.timer?.currentTimeSeconds;
 if(s.stageName||s.reference?.clock||Number.isFinite(seconds))lines.push('Tempo: '+(s.stageName||s.reference?.clock||'')+(Number.isFinite(seconds)?' · '+Math.floor(seconds/60)+'min':''));
 if(s.type==='favourite_first_half'){lines.push(s.bookmakerId+' · '+s.selection,'Vitória final: '+s.finalOdds.toFixed(2),'Vitória no 1º tempo: '+s.firstHalfOdds.toFixed(2));link(lines,s.sourceUrl)}
 else if(s.reference){lines.push('Casa em pré-jogo: '+(s.bookmakerName||s.bookmakerId),'Início listado: '+stamp(s.listedStartsAt),'Referência: '+s.reference.bookmakerName+' · '+s.reference.status,'Coleta da referência: '+stamp(s.reference.observedAt));link(lines,s.sourceUrl,'Partida na casa em pré-jogo');link(lines,s.reference.sourceUrl,'Partida na referência')}
 else for(const p of s.picks||[s.best,s.other].filter(Boolean)){if(p.marketName)lines.push(p.marketName);lines.push((p.bookmakerName||p.bookmakerId)+' · '+(p.selectionLabel||p.selectionName||p.selection)+' · odd '+p.decimalOdds.toFixed(2)+' · '+stamp(p.observedAt));link(lines,p.sourceUrl)}
 if(Number.isFinite(s.profitPercent))lines.push('Retorno matemático teórico: '+s.profitPercent.toFixed(2)+'%');
 if(Number.isFinite(s.gapPercent))lines.push('Diferença de preço: '+s.gapPercent.toFixed(1)+'%');
 lines.push('Coleta: '+stamp(s.observedAt)+' · Fortaleza',s.note||'Confira mercado, período e disponibilidade.','Sinal para conferência. Não garante lucro nem aceitação; odds podem mudar.');
 const isLink=l=>/^(Link da partida|Partida na casa em pré-jogo|Partida na referência): https:/.test(l);const reserved=lines.filter(isLink).reduce((n,l)=>n+l.length,0),others=lines.filter(l=>!isLink(l)).length,limit=Math.max(0,Math.min(250,Math.floor((4000-reserved-lines.length)/Math.max(1,others))));
 return lines.map(l=>isLink(l)?l:String(l).slice(0,limit)).join('\n');
}
export class TelegramAlerts{
 constructor(directory,{fetcher=fetch,now=Date.now}={}){this.dir=directory;this.fetcher=fetcher;this.now=now;this.busy=false;this.lastSentAt=null;this.error=null;this.sent={};this.hour=[];this.nextAllowed=0;this.ready=false;this.enabled=false;this.chatTitle=null;this.skippedMissingLinks=0}
 async init(){await fs.mkdir(this.dir,{recursive:true});try{const d=JSON.parse(await fs.readFile(this.dir+'/sent.json','utf8'));this.sent=d.sent||{};this.hour=d.hour||[]}catch(e){if(e.code!=='ENOENT')this.error='Estado de notificações inválido'}this.ready=true}
 status(){return {configured:this.enabled,chatTitle:this.chatTitle,lastSentAt:this.lastSentAt,lastError:this.error,skippedMissingLinks:this.skippedMissingLinks,sentLastHour:this.hour.filter(t=>this.now()-t<3600000).length}}
 async poll(signals){if(this.busy||!this.ready)return;this.busy=true;try{
  let config;try{config=JSON.parse(await fs.readFile(this.dir+'/config.json','utf8'))}catch(e){this.enabled=false;this.error=e.code==='ENOENT'?null:'Configuração local inválida';return}
  this.enabled=!!config.enabled;this.chatTitle=config.chatTitle||null;if(!this.enabled)return;
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(config.token||'')||!/^-[0-9]+$/.test(String(config.chatId))){this.error='Token ou grupo não configurado';return}
  const now=this.now();if(now<this.nextAllowed)return;this.hour=this.hour.filter(t=>now-t<3600000);this.sent=Object.fromEntries(Object.entries(this.sent).filter(([,t])=>now-t<86400000));
  const allowed=config.types||['surebet_candidate','favourite_first_half','market_price_inversion','started_as_prematch','finished_as_prematch'];
  this.skippedMissingLinks=0;let count=0;for(const s of signals){if(count>=3||this.hour.length>=20)break;const at=this.now(),age=at-Date.parse(s.observedAt),max=s.mode==='live'?40000:s.reference?90000:300000,cooldown=s.mode==='live'?600000:1800000;
   if(!allowed.includes(s.type)||age<0||age>max||at-(this.sent[s.id]||0)<cooldown)continue;
   if(!hasTelegramEventLinks(s)){this.skippedMissingLinks++;continue}
   const response=await this.fetcher('https://api.telegram.org/bot'+config.token+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:config.chatId,text:telegramText(s),link_preview_options:{is_disabled:true}}),signal:AbortSignal.timeout(10000)});
   let result;try{result=await response.json()}catch{throw Error('Resposta Telegram inválida')}
   if(!response.ok||!result.ok){this.nextAllowed=at+Math.max(30000,(result.parameters?.retry_after||30)*1000);throw Error('Telegram recusou envio (HTTP '+response.status+')')}
   this.sent[s.id]=this.now();this.hour.push(this.now());this.lastSentAt=new Date(this.now()).toISOString();count++;this.error=null;
   await fs.writeFile(this.dir+'/sent.tmp',JSON.stringify({sent:this.sent,hour:this.hour}));await fs.rename(this.dir+'/sent.tmp',this.dir+'/sent.json');
   // One message per poll avoids bursts and checks freshness again on the next cycle.
   break;
  }
 }catch(e){this.error=/^Telegram recusou|^Resposta Telegram|^Estado de/.test(e.message)?e.message:'Falha de conexão ou persistência no envio Telegram';this.nextAllowed=this.now()+30000}finally{this.busy=false}}
}
