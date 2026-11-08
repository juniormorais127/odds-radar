import fs from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import readline from 'node:readline';
import {once} from 'node:events';
export async function purgeLiveJournals(directory,ids){
 if(!ids.size)return;
 for(const name of await fs.readdir(directory)){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}\.jsonl$/.test(name)||Date.parse(name.slice(0,13)+':00:00Z')>=Date.now()-86400000)continue;
  const file=directory+'/'+name,temp=file+'.purge',output=createWriteStream(temp),input=readline.createInterface({input:createReadStream(file),crlfDelay:Infinity});
  try{for await(const line of input){let row;try{row=JSON.parse(line)}catch{continue}if(!ids.has(String(row.eventId))&&!output.write(line+'\n'))await once(output,'drain')}output.end();await once(output,'finish');await fs.rename(temp,file)}catch(e){output.destroy();await fs.rm(temp,{force:true});throw e}
 }
}
