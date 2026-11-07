export function parsePublicOdds(house,text){
 const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const price=s=>/^\d+(?:[.,]\d+)?$/.test(s||'')?Number(s.replace(',','.')):NaN;
 const valid=a=>a.length===3&&a.every(n=>Number.isFinite(n)&&n>1);
 const mk=(home,away,odds)=>({house,home,away,market:'Resultado final · tempo regulamentar',odds});
 if(house==='two'){
  const start=lines.findIndex((s,i)=>s==='Nottingham Forest'&&lines[i+1]==='Manchester City');
  if(start<0)return [];
  const b=lines.slice(start,start+70),i=b.indexOf('FT 1X2');
  const odds=[price(b[i+2]),price(b[i+4]),price(b[i+6])];
  return i>=0&&b[i+1]==='1'&&b[i+3]==='X'&&b[i+5]==='2'&&valid(odds)?[mk('Nottingham Forest','Manchester City',odds)]:[];
 }
 const names={grana:['Kigezi Homeboys','Mbarara City'],sportsbet:['Kigezi Homeboyz FC','Mbarara FC'],exclusive:['Kigezi Homeboys','Mbarara City FC'],stake:['Toulouse FC','Strasbourg Alsace'],fortune:['Instituto AC Cordoba','Newell´s Old Boys']}[house];
 if(!names)return [];
 const [home,away]=names;
 if(!text.includes(home)||!text.includes(away))return [];
 let start=lines.findIndex(s=>/^1x2$/i.test(s));
 if(house==='exclusive')start=lines.findIndex(s=>s.includes('Tempo ordinário')||s.includes('Regular time'));
 if(start<0)return [];
 const b=lines.slice(start+1,start+36);
 if(house==='fortune'){
  const i=b.indexOf('1'),odds=[price(b[i+1]),price(b[i+3]),price(b[i+5])];
  return i>=0&&/empate|draw/i.test(b[i+2])&&b[i+4]==='2'&&valid(odds)?[mk(home,away,odds)]:[];
 }
 const extract=label=>{const i=b.findIndex(s=>s===label||s.startsWith(label+' '));if(i<0)return NaN;return b[i]===label?price(b[i+1]):price(b[i].slice(label.length).trim())};
 const odds=[extract(home),extract('Empate'),extract(away)];
 if(!Number.isFinite(odds[1]))odds[1]=extract('empate');
 return valid(odds)?[mk(home,away,odds)]:[];
}
