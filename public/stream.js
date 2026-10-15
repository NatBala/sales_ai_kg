// Shared by the browser and server: frames can span arbitrary network chunks.
export async function readEvents(body,onEvent){
  const reader=body.getReader(),decoder=new TextDecoder();let buffer='',finished=false;
  function drain(final=false){
    let boundary;
    while((boundary=/\r?\n\r?\n/.exec(buffer))){
      const frame=buffer.slice(0,boundary.index);buffer=buffer.slice(boundary.index+boundary[0].length);
      const data=frame.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).replace(/^ /,'')).join('\n');
      if(data&&data!=='[DONE]')onEvent(JSON.parse(data));
    }
    if(buffer.length>1000000)throw new Error('Stream frame too large.');
    if(final&&buffer.trim())throw new Error('The response stream ended mid-frame.');
  }
  try{while(true){const {done,value}=await reader.read();if(done){buffer+=decoder.decode();drain(true);finished=true;break;}buffer+=decoder.decode(value,{stream:true});drain();}}
  finally{if(!finished)await reader.cancel().catch(()=>{});reader.releaseLock();}
}

// Only the first JSON summary field is displayed provisionally. The completed
// structured output still passes the summary agent's evidence validation.
export function summaryPrefix(json){
  const start=/^\s*\{\s*"summary"\s*:\s*"/.exec(json);if(!start)return '';
  let encoded='';
  for(let i=start[0].length;i<json.length;i++){
    const char=json[i];if(char==='"')break;
    if(char==='\\'){
      const next=json[i+1];if(!next)break;
      if(next==='u'){if(json.length<i+6)break;encoded+=json.slice(i,i+6);i+=5;}
      else{encoded+=char+next;i++;}
    }else encoded+=char;
  }
  const value=JSON.parse('"'+encoded+'"');
  return /[\uD800-\uDBFF]$/.test(value)?value.slice(0,-1):value;
}
