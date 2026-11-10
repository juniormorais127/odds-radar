export function specificEventUrl(value){try{
 if(typeof value!=='string'||value.length>600)return null;const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;
 const host=u.hostname,path=u.pathname;
 if(['girocerto.io','futamina.com'].includes(host)&&/^[0-9a-f-]{36}$/i.test(u.searchParams.get('jogo')||''))return u.href;
 if(host==='sport-iframe.aakvjlhif.com'&&/^\/pt\/events\/.+-\d+$/.test(path))return u.href;
 if(host==='granawin-go.com'&&/^\/br\/(prematch|live)\/football\/[^/]+\/\d+-[^/]+/.test(path))return u.href;
 if(['sports2.exclusivebeteu.com','exclusivebeteu.com'].includes(host)&&/\/(evento|event)\/.+\/\d+/.test(path))return u.href;
 if(host==='esportenet-bet.jogos.app'&&/\/Apostas\.aspx$/i.test(path)&&/^\d+$/.test(u.searchParams.get('idpartida')||''))return u.href;
 return null;
}catch{return null}}
export function tobetanoEventUrl(id,event){return /^\d+$/.test(String(id))&&/^[a-z0-9-]+$/i.test(event?.slug||'')?'https://sport-iframe.aakvjlhif.com/pt/events/'+event.slug+'-'+id:null}
export function hasTelegramEventLinks(signal){
 if(signal.reference)return !!specificEventUrl(signal.sourceUrl)&&!!specificEventUrl(signal.reference.sourceUrl);
 if(signal.type==='favourite_first_half')return !!specificEventUrl(signal.sourceUrl);
 const rows=signal.picks||[signal.best,signal.other].filter(Boolean);
 return rows.length>0&&rows.every(q=>!!specificEventUrl(q.sourceUrl));
}
