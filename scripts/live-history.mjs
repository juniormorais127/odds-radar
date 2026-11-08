import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import readline from 'node:readline';
export function liveSeriesId(row){
 const m=row.market||{},line=row.line?.marketParameters||[],s=row.selection||{};
 const value=JSON.stringify([row.bookmakerId||'tobetano',String(row.eventId),m.resultKind,m.marketType,m.period,m.subPeriod??null,m.layout??null,line,s.type,s.values||[]]);
 return createHash('sha256').update(value).digest('hex');
}
export function compactScore(scoreboard){return {score:scoreboard?.scores?.find(s=>s.periodScoreType===1&&s.period===1&&!s.isRemoved)?.score??null,stage:scoreboard?.stage??null,seconds:scoreboard?.timer?.currentTimeSeconds??null};}
export class LiveHistory {
 constructor(file){this.db=new DatabaseSync(file);this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS series(id TEXT PRIMARY KEY, event_id TEXT, metadata TEXT); CREATE TABLE IF NOT EXISTS points(series_id TEXT, at TEXT, odd REAL, context TEXT, PRIMARY KEY(series_id,at)); CREATE INDEX IF NOT EXISTS points_time ON points(at); CREATE TABLE IF NOT EXISTS imports(name TEXT PRIMARY KEY, size INTEGER);');
  this.db.exec('CREATE TABLE IF NOT EXISTS expired_events(event_id TEXT PRIMARY KEY, at TEXT)');
  this.insert=this.db.prepare('INSERT OR IGNORE INTO points VALUES(?,?,?,?)');this.meta=this.db.prepare('INSERT INTO series VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET event_id=excluded.event_id,metadata=excluded.metadata');
  this.current=new Map();this.seed=this.db.prepare('INSERT INTO points SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM points WHERE series_id=?)');
 }
 append(rows,now=Date.now()){
  this.db.exec('BEGIN');try{for(const r of rows){if(this.db.prepare('SELECT 1 FROM expired_events WHERE event_id=?').get(String(r.eventId)))continue;const price=r.after??r.price,at=r.at;if(!Number.isFinite(price)||price<=1||!Number.isFinite(Date.parse(at))||Date.parse(at)<now-72*3600000||Date.parse(at)>now)continue;this.insert.run(liveSeriesId(r),new Date(at).toISOString(),price,JSON.stringify(compactScore(r.scoreboard)))}this.db.exec('COMMIT')}catch(e){this.db.exec('ROLLBACK');throw e}
 }
 attach(snapshot){
  this.current.clear();
  this.db.exec('BEGIN');try{for(const g of snapshot.events)for(const m of g.markets)for(const item of m.marketItems)for(const o of item.outcomes){
   const id=liveSeriesId({eventId:g.id,bookmakerId:g.bookmakerId||'tobetano',market:m.key,line:item.key,selection:o.key});o.seriesId=id;
   const metadata={id,eventId:g.id,event:g.event.name,bookmakerId:g.bookmakerId||'tobetano',bookmakerName:g.bookmakerName||'Tobetano',market:m.name||'Mercado '+m.key.marketType,resultKind:m.resultKindName,period:m.periodName||String(m.key.period),line:item.lineLabel||item.key.marketParameters.join(' / ')||'Sem linha',selection:o.name||'Seleção '+o.key.type};
   this.meta.run(id,g.id,JSON.stringify(metadata));
   const observation={at:g.observedAt||snapshot.observedAt,odd:o.decimalOdds,context:compactScore(g.event.scoreboard),metadata,available:!o.isFrozen&&g.event.tradingStatus===1};this.current.set(id,observation);
   if(observation.available&&observation.odd>1)this.seed.run(id,observation.at,observation.odd,JSON.stringify(observation.context),id);
  }this.db.exec('COMMIT')}catch(e){this.db.exec('ROLLBACK');throw e}
 }
 prune(now=Date.now()){const cutoff=new Date(now-72*3600000).toISOString();this.db.prepare('DELETE FROM points WHERE at < ?').run(cutoff);this.db.exec('DELETE FROM series WHERE id NOT IN (SELECT DISTINCT series_id FROM points)');}
 deleteEvent(eventId){this.db.prepare('INSERT OR IGNORE INTO expired_events VALUES(?,?)').run(eventId,new Date().toISOString());const ids=this.db.prepare('SELECT id FROM series WHERE event_id=?').all(eventId);this.db.exec('BEGIN');try{for(const {id} of ids){this.db.prepare('DELETE FROM points WHERE series_id=?').run(id);this.db.prepare('DELETE FROM series WHERE id=?').run(id);this.current.delete(id)}this.db.exec('COMMIT')}catch(e){this.db.exec('ROLLBACK');throw e}}
 get(id,hours=72,limit=2000,now=Date.now()){
  const cutoff=new Date(now-Math.min(72,Math.max(1,hours))*3600000).toISOString(),end=new Date(now).toISOString();
  const metadata=this.db.prepare('SELECT metadata FROM series WHERE id=?').get(id);
  const stats=this.db.prepare('SELECT count(*) AS count,min(odd) AS minimum,max(odd) AS maximum FROM points WHERE series_id=? AND at>=? AND at<=?').get(id,cutoff,end);
  let first=this.db.prepare('SELECT at,odd FROM points WHERE series_id=? AND at>=? AND at<=? ORDER BY at LIMIT 1').get(id,cutoff,end);
  let latest=this.db.prepare('SELECT at,odd FROM points WHERE series_id=? AND at>=? AND at<=? ORDER BY at DESC LIMIT 1').get(id,cutoff,end);
  const points=this.db.prepare('SELECT at,odd,context FROM points WHERE series_id=? AND at>=? AND at<=? ORDER BY at DESC LIMIT ?').all(id,cutoff,end,Math.min(20000,Math.max(1,limit))).reverse().map(p=>({...p,context:JSON.parse(p.context||'null')}));
  const current=this.current.get(id);if(current?.available&&current.at>=cutoff&&now-Date.parse(current.at)>=0&&now-Date.parse(current.at)<=40000&&(!latest||current.at>latest.at)){points.push({at:current.at,odd:current.odd,context:current.context});latest={at:current.at,odd:current.odd};first||=latest;stats.minimum=stats.minimum==null?current.odd:Math.min(stats.minimum,current.odd);stats.maximum=stats.maximum==null?current.odd:Math.max(stats.maximum,current.odd);stats.count++;}
  return {generatedAt:end,retentionHours:72,metadata:metadata?JSON.parse(metadata.metadata):current?.metadata||null,current:current?{at:current.at,odd:current.odd,available:current.available,stale:now-Date.parse(current.at)>40000}:null,stats:{...stats,first:first||null,latest:latest||null,changePercent:first&&latest?(latest.odd/first.odd-1)*100:null},points,note:'Pontos coletados quando houve alteração, com a observação atual. Não reconstrói mudanças entre coletas; somente mesma casa, jogo, mercado, período, linha e seleção.'};
 }
 async importJournal(directory){
  let files=[];try{files=await fs.readdir(directory)}catch(e){if(e.code!=='ENOENT')throw e}
  let imported=0;for(const name of files.filter(n=>/^\d{4}-\d{2}-\d{2}T\d{2}\.jsonl$/.test(n))){const file=directory+'/'+name,size=(await fs.stat(file)).size,oldSize=this.db.prepare('SELECT size FROM imports WHERE name=?').get(name)?.size||0;if(oldSize===size||!size)continue;
   const start=oldSize<size?oldSize:0,lines=readline.createInterface({input:createReadStream(file,{start,end:size-1}),crlfDelay:Infinity});let batch=[],offset=start,complete=start;for await(const line of lines){offset+=Buffer.byteLength(line,'utf8')+1;try{batch.push(JSON.parse(line));complete=Math.min(size,offset)}catch{if(!line.trim())complete=Math.min(size,offset)}if(batch.length>=1000){this.append(batch);imported+=batch.length;batch=[];await new Promise(resolve=>setImmediate(resolve))}}if(batch.length){this.append(batch);imported+=batch.length}
   this.db.prepare('INSERT INTO imports VALUES(?,?) ON CONFLICT(name) DO UPDATE SET size=excluded.size').run(name,complete);
  }this.prune();return imported;
 }
 close(){this.db.close()}
}
