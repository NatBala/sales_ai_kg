import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {readEvents} from '../public/stream.js';
const base='http://127.0.0.1:8765',report={tested_at:new Date().toISOString(),checks:[]};
const options=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
async function post(route,body){const response=await fetch(base+route,options(body));const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;}
const demos=JSON.parse(await readFile(new URL('../demo-questions.json',import.meta.url),'utf8')),results=new Map();
for(const demo of demos){
  const start=Date.now(),data=await post('/api/ask',{example_id:demo.id,defer_summary:true});
  assert.equal(data.planning_mode,'preset');assert.equal(data.query_template,demo.template);assert.equal(data.summary_agent.status,'pending');assert(!data.insights);assert(data.rows.length>0);assert(data.graph.nodes.length>0);results.set(demo.id,data);
  report.checks.push({name:demo.capability,graph_ms:Date.now()-start,rows:data.rows.length,nodes:data.graph.nodes.length,edges:data.graph.edges.length,embedding_used:data.embedding_used});console.log('PASS demo:',demo.id,data.rows.length+' rows',data.elapsed_ms+'ms');
}
assert.equal(results.get('holdings').rows.length,3);assert.equal(results.get('similarity').rows.length,3);assert.equal(results.get('embeddings').embedding_used,true);assert.equal(results.get('recommendations').rows.length,2);assert.equal(results.get('audience').rows.length,3);
const result=results.get('holdings'),started=Date.now(),response=await fetch(base+'/api/summarize/stream',options({result_id:result.result_id}));assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/event-stream/);
const events=[];let firstDeltaMs,summaryText='',complete,newQuery;
await readEvents(response.body,event=>{
  events.push(event.type);
  if(event.type==='started')newQuery=post('/api/run',{cypher:'RETURN 42 AS answer',defer_summary:true}).then(data=>({data,ms:Date.now()-started}));
  if(event.type==='summary_delta'){firstDeltaMs??=Date.now()-started;summaryText+=event.delta;assert(!complete);}
  if(event.type==='complete'){complete=event.result;}
});
assert(events.indexOf('started')<events.indexOf('summary_delta'));assert(events.indexOf('summary_delta')<events.indexOf('complete'));assert.equal(complete.summary_agent.status,'complete');assert.equal(summaryText,complete.insights.summary);
const allowed=new Set([...result.rows.map((_,i)=>'row:'+(i+1)),...result.graph.nodes.map(n=>'node:'+n.id),...result.graph.edges.map(e=>'edge:'+e.id)]);
assert(complete.insights.summary_evidence_refs.length);assert(complete.insights.summary_evidence_refs.every(ref=>allowed.has(ref)));
const during=await newQuery;assert.equal(during.data.rows[0].answer,42);assert(during.ms<firstDeltaMs,'New query should not wait for summary');
report.checks.push({name:'True model streaming after graph response; concurrent query remains available',first_delta_ms:firstDeltaMs,complete_ms:Date.now()-started,delta_count:events.filter(t=>t==='summary_delta').length,concurrent_query_ms:during.ms,summary:complete.insights.summary});console.log('PASS streaming and concurrent query');
const cachedResponse=await fetch(base+'/api/summarize/stream',options({result_id:result.result_id})),cached=[];await readEvents(cachedResponse.body,e=>cached.push(e));assert.deepEqual(cached.map(e=>e.type),['started','complete']);assert.deepEqual(cached[1].result.insights,complete.insights);
report.checks.push({name:'Completed summary cache reused without additional generation'});
const empty=await post('/api/run',{cypher:"MATCH (a:Advisor {id:'MISSING'}) RETURN a",defer_summary:true});const emptyResponse=await fetch(base+'/api/summarize/stream',options({result_id:empty.result_id}));let emptySummary;await readEvents(emptyResponse.body,e=>{if(e.type==='complete')emptySummary=e.result;});assert.equal(emptySummary.summary_agent.status,'empty');report.checks.push({name:'Empty result streams explicit no-matches response without model generation'});
const unknown=await fetch(base+'/api/summarize/stream',options({result_id:'invented'}));assert.equal(unknown.status,400);
const invalid=await fetch(base+'/api/ask',options({example_id:'invented',defer_summary:true}));assert.equal(invalid.status,400);report.checks.push({name:'Unknown result and example IDs rejected'});
await writeFile(new URL('../streaming-verification.json',import.meta.url),JSON.stringify(report,null,2));console.log('All streaming live checks passed.');
