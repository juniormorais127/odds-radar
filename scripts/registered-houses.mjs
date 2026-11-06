import fs from 'node:fs';
export function withRegisteredHouses(html){
 const registry=JSON.parse(fs.readFileSync(new URL('../worker/house-registry.json',import.meta.url),'utf8'));
 const code=fs.readFileSync(new URL('../worker/registered-houses.js',import.meta.url),'utf8');
 if(registry.houses.length!==6||registry.records.some(r=>!registry.houses.some(h=>h.key===r.house)||r.odds.length!==3||r.odds.some(o=>!Number.isFinite(o)||o<=1)))throw Error('Cadastro de casas inválido');
 html=html.replace('</nav>','<button role="tab" data-tab="houses" aria-selected="false">Novas casas · coleta manual</button></nav><div id="registeredPane" hidden><h2>Novas casas cadastradas</h2><p class="muted">Cotações observadas nas páginas públicas. Atualização automática ainda não integrada.</p><div class="notice warn">Consulta manual de 06/11/2026, com horário exato não registrado. Estes valores podem ter mudado e não entram nas surebets, odds desajustadas ou alertas atuais.</div><div class="catalogFilters"><label>Casa cadastrada<select id="registeredHouse"><option value="">Todas as seis casas</option></select></label><label>Jogo ou mercado<input id="registeredQuery" type="search" placeholder="Ex.: Kigezi, City, primeiro tempo"></label><label>Mercado<select id="registeredMarket"><option value="">Todos os mercados</option><option value="final">Resultado final</option><option value="half">Primeiro tempo</option></select></label></div><div id="registeredSummary" class="help" aria-live="polite"></div><div id="registeredRows"></div><details><summary>Cadastro e situação das integrações</summary><div id="registeredSources"></div></details></div>');
 html=html.replace('<script>','<script>\nconst HOUSE_REGISTRY='+JSON.stringify(registry).replaceAll('<','\\u003c')+';\n'+code+'\n');
 html=html.replace("const special=tab==='alerts'||tab==='catalog';","$('registeredPane').hidden=tab!=='houses';const special=tab==='alerts'||tab==='catalog'||tab==='houses';");
 html=html.replace("if(special){if(tab==='catalog'&&!catalogIndex)","if(special){if(tab==='houses')renderRegisteredHouses();if(tab==='catalog'&&!catalogIndex)");
 html=html.replace("$('refresh').onclick=refresh;","initRegisteredHouses();$('refresh').onclick=refresh;");
 html=html.replace('Giro Certo / Esportenet / Melbet / Esportenet Jogos / Futamina</small>','5 fontes automáticas · 6 novas casas com consulta manual</small>');
 return html;
}
