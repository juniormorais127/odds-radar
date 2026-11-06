function initRegisteredHouses(){
 $('registeredHouse').innerHTML='<option value="">Todas as seis casas</option>'+HOUSE_REGISTRY.houses.map(h=>'<option value="'+esc(h.key)+'">'+esc(h.name)+'</option>').join('');
 for(const id of ['registeredHouse','registeredQuery','registeredMarket'])$(id).addEventListener('input',renderRegisteredHouses);
 $('registeredSources').innerHTML=HOUSE_REGISTRY.houses.map(h=>'<p><strong>'+esc(h.name)+'</strong> · cadastrada · API automática não confirmada. <a href="'+esc(h.url)+'" target="_blank" rel="noopener noreferrer">Abrir casa</a>'+(h.note?'<span class="sub">'+esc(h.note)+'</span>':'')+'</p>').join('');
}
function registeredMatches(registry,house,query,market){
 const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const q=normalize(query);
 return registry.records.filter(r=>(!house||r.house===house)&&(!market||(market==='half'?r.market.includes('1º tempo'):r.market.includes('Resultado final')))&&(!q||normalize([r.home,r.away,r.league,r.market,r.market.includes('1º tempo')?'primeiro tempo':'',registry.houses.find(h=>h.key===r.house).name].join(' ')).includes(q)));
}
function renderRegisteredHouses(){
 const rows=registeredMatches(HOUSE_REGISTRY,$('registeredHouse').value,$('registeredQuery').value,$('registeredMarket').value);
 $('registeredSummary').textContent=rows.length+' mercados · '+rows.length*3+' cotações na consulta manual · 6 casas cadastradas';
 $('registeredRows').innerHTML=rows.length?'<div class="scroll"><table><thead><tr><th>Casa</th><th>Jogo</th><th>Mercado</th><th>Casa · 1</th><th>Empate · X</th><th>Visitante · 2</th><th>Origem</th></tr></thead><tbody>'+rows.map(r=>{const h=HOUSE_REGISTRY.houses.find(h=>h.key===r.house);return '<tr><td>'+esc(h.name)+'</td><td class="game">'+esc(r.home)+' × '+esc(r.away)+'<span class="sub">'+esc(r.league)+'</span></td><td>'+esc(r.market)+(r.requiresReview?'<span class="sub">Divergência grande: conferir evento e cotação na casa.</span>':'')+'</td>'+r.odds.map(o=>'<td>'+fmt(o)+'</td>').join('')+'<td><a href="'+esc(h.url)+'" target="_blank" rel="noopener noreferrer">Conferir na casa</a><span class="sub">Manual · 06/11/2026 · sem horário registrado</span></td></tr>'}).join('')+'</tbody></table></div>':'<div class="empty"><h3>Nenhuma cotação neste filtro</h3><p>Remova parte da busca ou selecione todas as casas.</p></div>';
}
