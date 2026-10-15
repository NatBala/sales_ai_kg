import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const report=JSON.parse(await readFile(new URL('../verification.json',import.meta.url),'utf8'));
const cases=[
 ['Holdings and flows','Show Alex’s fund holdings, assets, September sales, redemptions and net flows.',d=>{
   assert.equal(d.rows.length,3);
   const gfa=d.rows.find(r=>/AGTHX|Growth Fund of America/i.test(JSON.stringify(r)));assert(gfa);for(const amount of [4200000,200000,600000,-400000])assert(Object.values(gfa).includes(amount));
   assert.equal(d.graph.nodes.filter(n=>n.labels.includes('Advisor')).length,1);
 }],
 ['Custom aggregate','How many advisors does each salesperson cover? Return their names and advisor counts.',d=>{
   assert.equal(d.query_template,'custom');assert.equal(d.rows.length,2);
   assert(d.rows.every(r=>Object.values(r).includes(10)));assert(JSON.stringify(d.rows).includes('Elena'));assert(JSON.stringify(d.rows).includes('Marcus'));
 }]
];
for(const[name,question,verify]of cases){
 const r=await fetch('http://127.0.0.1:8765/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,history:[]}),signal:AbortSignal.timeout(180000)});const d=await r.json();await writeFile(new URL('../../../work/app-additional-test-response.json',import.meta.url),JSON.stringify(d,null,2));assert.equal(r.status,200,JSON.stringify(d));verify(d);
 report.queries=report.queries.filter(q=>q.name!==name);report.queries.push({name,question,query_template:d.query_template,title:d.title,rows:d.rows.length,nodes:d.graph.nodes.length,edges:d.graph.edges.length,repaired:d.repaired,results:d.rows,cypher:d.cypher,graph_cypher:d.graph_cypher});
 await writeFile(new URL('../verification.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({test:name,pass:true,rows:d.rows.length,nodes:d.graph.nodes.length,repaired:d.repaired}));
}
