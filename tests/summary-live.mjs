import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:8765',report={tested_at:new Date().toISOString(),checks:[]};
async function post(route,body){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d;}
function verifyEvidence(result,summary){
 assert.equal(summary.summary_agent.status,'complete');assert(summary.insights.summary.length>20);
 const allowed=new Set([...result.rows.map((_,i)=>'row:'+(i+1)),...result.graph.nodes.map(n=>'node:'+n.id),...result.graph.edges.map(e=>'edge:'+e.id)]);
 const refs=[...summary.insights.summary_evidence_refs,...summary.insights.insights.flatMap(x=>x.evidence_refs),...summary.insights.next_actions.flatMap(x=>x.evidence_refs)];assert(refs.length);assert(refs.every(ref=>allowed.has(ref)));
 assert.equal(summary.summary_agent.coverage.returned_relationships,result.graph.edges.length);
}
const natural=await post('/api/ask',{question:'Show Alex’s fund holdings, assets, September sales, redemptions and net flows.',defer_summary:true});
assert.equal(natural.summary_agent.status,'pending');assert.equal(natural.rows.length,3);assert(natural.graph.nodes.length>0);assert(!natural.insights);
const summary=await post('/api/summarize',{result_id:natural.result_id});verifyEvidence(natural,summary);
assert.match(summary.insights.summary,/Alex|GFA|Growth Fund/i);
const cached=await post('/api/summarize',{result_id:natural.result_id});assert.deepEqual(cached.insights,summary.insights);assert.deepEqual(cached.summary_agent,summary.summary_agent);
report.checks.push({name:'Natural language: graph returned first, then cited summary; cached summary reused',summary:summary.insights,agent:summary.summary_agent});console.log('PASS: natural language, deferred graph summary and cached response');
const manual=await post('/api/run',{cypher:"MATCH p=(a:Advisor {id:'ADV-101'})-[:MEMBER_OF]->(:BuyingUnit)-[pos:POSITION_AS_OF]->(:Instrument)-[:OF_FUND]->(:Fund) WHERE pos.as_of=date('2026-09-29') RETURN p LIMIT 10",defer_summary:true});
assert.equal(manual.summary_agent.status,'pending');const manualSummary=await post('/api/summarize',{result_id:manual.result_id});verifyEvidence(manual,manualSummary);assert(manualSummary.summary_agent.coverage.reviewed_relationships>0);
report.checks.push({name:'Manual Cypher graph paths receive a graph-aware summary',summary:manualSummary.insights,agent:manualSummary.summary_agent});console.log('PASS: manual Cypher graph summary');
const scalar=await post('/api/run',{cypher:'MATCH (s:Employee)-[:COVERS_ADVISOR]->(a:Advisor) RETURN s.full_name AS Salesperson,count(a) AS Advisors'});verifyEvidence(scalar,scalar);assert.equal(scalar.rows.length,2);assert.equal(scalar.graph.nodes.length,0);report.checks.push({name:'Scalar-only Cypher summarized automatically',summary:scalar.insights});console.log('PASS: scalar-only result summary');
const empty=await post('/api/run',{cypher:"MATCH (a:Advisor {id:'DOES-NOT-EXIST'}) RETURN a"});assert.equal(empty.summary_agent.status,'empty');assert.equal(empty.rows.length,0);report.checks.push({name:'No matches produce explicit empty summary'});
const unknown=await fetch(base+'/api/summarize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({result_id:'invented',graph:{nodes:[{name:'Fake'}]}})});assert.equal(unknown.status,400);report.checks.push({name:'Summary endpoint rejects unknown result IDs and does not accept a client-supplied graph'});
await writeFile(new URL('../summary-verification.json',import.meta.url),JSON.stringify(report,null,2));console.log('All live summary agent checks passed.');
