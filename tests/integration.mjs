import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await readFile(path.resolve(root,'../../work/graph-app-connection.json'),'utf8'));
const base='http://127.0.0.1:'+config.port;const report={tested_at:new Date().toISOString(),checks:[],queries:[]};
async function post(route,body){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(240000)});return {status:r.status,data:await r.json()};}
for(const query of ['MATCH (n) DETACH DELETE n','CALL dbms.listConfig() YIELD name RETURN name','LOAD CSV FROM "https://example.com" AS r RETURN r']){const r=await post('/api/run',{cypher:query});assert.equal(r.status,400);report.checks.push('Blocked unsafe Cypher: '+query);}
const cross=await fetch(base+'/api/run',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify({cypher:'RETURN 1'})});assert.equal(cross.status,403);report.checks.push('Cross-origin requests blocked');
const malformed=await fetch(base+'/api/run',{method:'POST',headers:{'Content-Type':'application/json',Origin:'null'},body:'{}'});assert.equal(malformed.status,403);report.checks.push('Invalid origins handled without server crash');
const auth='Basic '+Buffer.from(config.username+':'+config.password).toString('base64');
const writeResponse=await fetch(config.http+'/db/'+config.database+'/tx',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({statements:[{statement:'CREATE (:AtlasWriteProbe {id:"rollback-only-permission-check"}) RETURN 1'}]})});
const writeResult=await writeResponse.json();
if(!writeResult.errors?.length){if(writeResult.commit)await fetch(writeResult.commit.replace(/\/commit$/,''),{method:'DELETE',headers:{Authorization:auth}});throw new Error('The database user unexpectedly has write privileges. Probe was rolled back.');}
assert(writeResult.errors.some(e=>/Forbidden|Authorization/i.test(e.code)));report.checks.push('Neo4j itself denies writes for the dedicated app user');
const cases=[
 ['Similar advisors','Who are the top three advisors most similar to Alex by fund allocation? Show their shared funds and overlap percentages.',d=>{assert.equal(d.rows.length,3);for(const name of ['Henry Taylor','Owen Carter','Chloe Davis'])assert(JSON.stringify(d.rows).includes(name));}],
 ['Semantic article search','Find articles to help clients organize family information before their first appointment with a lawyer.',d=>{assert.equal(d.embedding_used,true);assert(JSON.stringify(d.rows[0]).toLowerCase().includes('estate planning'));}],
 ['Content recommendations','What articles should Elena review before meeting Alex, based on his explicit meeting request? Show the supporting evidence.',d=>{assert(JSON.stringify(d.rows).includes('Active ETF models'));assert(JSON.stringify(d.rows).includes('NOT_ESTABLISHED'));}],
 ['Sales follow-ups','Which of Elena’s advisors have net redemptions and repeated visits to the same fund’s product page in September? Show the next actions.',d=>{assert(JSON.stringify(d.rows).includes('Alex'));assert(JSON.stringify(d.rows).includes('-400000'));}],
 ['Article audience','Which advisors other than Alex have asked for the topic covered by the Active ETF models at Wells Fargo article? Show their salespeople and meeting evidence.',d=>{for(const name of ['Emma','Sofia','Victor'])assert(JSON.stringify(d.rows).includes(name));}],
 ['Unavailable data','What were Alex’s actual sales in January 2024?',d=>{assert(d.clarification||d.rows.length===0);}]
];
for(const [name,question,verify]of cases.filter(c=>!process.env.DEMO_CASE||c[0]===process.env.DEMO_CASE)){const r=await post('/api/ask',{question,history:[]});await writeFile(path.resolve(root,'../../work/app-last-test-response.json'),JSON.stringify({name,...r},null,2));assert.equal(r.status,200,JSON.stringify(r.data));verify(r.data);if(!r.data.clarification){assert(r.data.graph.nodes.length>0||name==='Unavailable data');assert(r.data.insights.summary);assert(!JSON.stringify(r.data).includes('"embedding":'));}
  report.queries.push({name,question,title:r.data.title,rows:r.data.rows?.length||0,nodes:r.data.graph?.nodes.length||0,edges:r.data.graph?.edges.length||0,embedding_used:r.data.embedding_used||false,repaired:r.data.repaired||false,elapsed_ms:r.data.elapsed_ms,clarification:r.data.clarification||'',results:r.data.rows||[],cypher:r.data.cypher,graph_cypher:r.data.graph_cypher});
  await writeFile(path.join(root,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({test:name,pass:true,rows:r.data.rows?.length,nodes:r.data.graph?.nodes.length,elapsed_ms:r.data.elapsed_ms,repaired:r.data.repaired}));
}
console.log('All live integration checks passed.');
