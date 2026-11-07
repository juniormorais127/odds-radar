import fs from 'node:fs';
import {browserRecords} from './browser-quotes.mjs';
export function withRegisteredHouses(html){
 const registry=JSON.parse(fs.readFileSync(new URL('../worker/house-registry.json',import.meta.url),'utf8'));
 const livePath=new URL('../collector-output/new-houses.json',import.meta.url);
 if(fs.existsSync(livePath)){
  const live=JSON.parse(fs.readFileSync(livePath,'utf8'));
  registry.collection=live;
  for(const source of live.sources||[]){
   const house=registry.houses.find(h=>h.key===source.key);if(!house)continue;
   house.collection={ok:source.ok,at:source.at,error:source.error};
   if(!source.ok)continue;
   const good=(source.records||[]).filter(r=>r.house===source.key&&Array.isArray(r.odds)&&r.odds.length===3&&r.odds.every(o=>Number.isFinite(o)&&o>1));
   if(!good.length)continue;
   registry.records=registry.records.filter(r=>r.house!==source.key).concat(good.map(r=>({...r,at:source.at,automatic:true,league:'Amostra de evento cadastrado'})));
  }
 }
 const code=fs.readFileSync(new URL('../worker/registered-houses.js',import.meta.url),'utf8');
 const observed=browserRecords().filter(r=>{const c=registry.houses.find(h=>h.key===r.house)?.collection;return !c?.ok||Date.parse(c.at)<=Date.parse(r.at)});
 for(const key of new Set(observed.map(r=>r.house)))registry.records=registry.records.filter(r=>r.house!==key);
 registry.records.push(...observed);
 if(registry.houses.length!==6||registry.records.some(r=>!registry.houses.some(h=>h.key===r.house)||r.odds.length!==3||r.odds.some(o=>!Number.isFinite(o)||o<=1)))throw Error('Cadastro de casas inválido');
 html=html.replace('</nav>','<button role="tab" data-tab="houses" aria-selected="false">Novas casas · coleta manual</button></nav><div id="registeredPane" hidden><h2>Novas casas cadastradas</h2><p class="muted">Cotações observadas nas páginas públicas. Atualização automática ainda não integrada.</p><div class="notice warn">Consulta manual de 06/11/2026, com horário exato não registrado. Estes valores podem ter mudado e não entram nas surebets, odds desajustadas ou alertas atuais.</div><div class="catalogFilters"><label>Casa cadastrada<select id="registeredHouse"><option value="">Todas as seis casas</option></select></label><label>Jogo ou mercado<input id="registeredQuery" type="search" placeholder="Ex.: Kigezi, City, primeiro tempo"></label><label>Mercado<select id="registeredMarket"><option value="">Todos os mercados</option><option value="final">Resultado final</option><option value="half">Primeiro tempo</option></select></label></div><div id="registeredSummary" class="help" aria-live="polite"></div><div id="registeredRows"></div><details><summary>Cadastro e situação das integrações</summary><div id="registeredSources"></div></details></div>');
 html=html.replace('<script>','<script>\nconst HOUSE_REGISTRY='+JSON.stringify(registry).replaceAll('<','\\u003c')+';\n'+code+'\n');
 html=html.replace("futamina:'Futamina'","futamina:'Futamina',two:'2UP',grana:'Granawin',sportsbet:'Sportsbet.io',exclusive:'ExclusiveBet',stake:'Stake',fortune:'FortuneJack'");
 html=html.replaceAll("['giro','esporte','melbet','jogos','futamina']","Object.keys(names)");
 html=html.replace('<th>Futamina</th>','<th>Futamina</th><th>2UP</th><th>Granawin</th><th>Sportsbet.io</th><th>ExclusiveBet</th><th>Stake</th><th>FortuneJack</th>');
 html=html.replace('<option value="futamina">Futamina</option>','<option value="futamina">Futamina</option>'+registry.houses.map(h=>'<option value="'+h.key+'">'+h.name+'</option>').join(''));
 html=html.replace("(tab==='search'||!b.offline||","(tab==='search'||(tab==='value'&&b.manualSnapshot)||!b.offline||");
 html=html.replace("(tab!=='search'&&b.offline&&","(tab!=='search'&&!(tab==='value'&&b.manualSnapshot)&&b.offline&&");
 html=html.replace("'<span class=\"sub\">Coleta local '+date(b.at)","'<span class=\"sub\">'+(b.manualSnapshot?'Leitura navegador ':'Coleta local ')+date(b.at)");
 html=html.replace("(s.offline?' · coleta local '+date(s.at)","(s.offline?(s.manualSnapshot?' · leitura navegador ':' · coleta local ')+date(s.at)");
 html=html.replace('Resultado final · tempo regulamentar. Sem jogos ao vivo ou cotações com indicação de suspensão.','Resultado final · tempo regulamentar. As leituras assistidas têm horário próprio nas células e não são renovadas pela coleta automática.');
 html=html.replace("const special=tab==='alerts'||tab==='catalog';","$('registeredPane').hidden=tab!=='houses';const special=tab==='alerts'||tab==='catalog'||tab==='houses';");
 html=html.replace("if(special){if(tab==='catalog'&&!catalogIndex)","if(special){if(tab==='houses')renderRegisteredHouses();if(tab==='catalog'&&!catalogIndex)");
 html=html.replace("$('refresh').onclick=refresh;","initRegisteredHouses();$('refresh').onclick=refresh;");
 html=html.replace('Giro Certo / Esportenet / Melbet / Esportenet Jogos / Futamina</small>','5 fontes automáticas · 6 novas casas com consulta manual</small>');
 html=html.replace('Novas casas · coleta manual','Novas casas · situação da coleta')
  .replace('Cotações observadas nas páginas públicas. Atualização automática ainda não integrada.','Coleta agendada por navegador público, sem login, nos eventos de exemplo cadastrados. Não cobre todos os jogos. Consulte abaixo quais casas responderam.')
  .replace('Consulta manual de 06/11/2026, com horário exato não registrado. Estes valores podem ter mudado e não entram nas surebets, odds desajustadas ou alertas atuais.','Cada linha informa se houve coleta automática ou se é a consulta manual antiga. Falhas e bloqueios não renovam as odds antigas. Esta amostra não entra nas surebets nem nos alertas atuais.')
  .replace('6 novas casas com consulta manual</small>','6 novas casas com situação da coleta</small>');
 return html;
}
