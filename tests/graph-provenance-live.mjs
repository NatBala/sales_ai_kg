import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {sanitize} from '../guard.mjs';
import {propertyRows} from '../public/graph.js';
const cfg=JSON.parse(await readFile(new URL('../../../work/graph-app-connection.json',import.meta.url),'utf8'));
const demos=JSON.parse(await readFile(new URL('../demo-questions.json',import.meta.url),'utf8'));
const report={tested_at:new Date().toISOString(),database:cfg.database,checks:[]};
async function direct(query,parameters){
  const response=await fetch(cfg.http+'/db/'+cfg.database+'/tx/commit',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(cfg.username+':'+cfg.password).toString('base64'),'Content-Type':'application/json'},body:JSON.stringify({statements:[{statement:query,parameters,resultDataContents:['graph']}]})});
  const payload=await response.json();assert.equal(response.status,200);assert.deepEqual(payload.errors,[]);return payload.results[0].data;
}
for(const demo of demos){
  const response=await fetch('http://127.0.0.1:8765/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({example_id:demo.id,defer_summary:true})});
  const answer=await response.json();assert.equal(response.status,200,JSON.stringify(answer));
  const graph=answer.graph;assert(graph.nodes.length&&graph.edges.length);assert(graph.nodes.every(n=>n.elementId));assert(graph.edges.every(e=>e.elementId));
  const rows=await direct('MATCH (n) WHERE elementId(n) IN $nodeIds RETURN n UNION ALL MATCH ()-[r]->() WHERE elementId(r) IN $edgeIds RETURN r AS n',{nodeIds:graph.nodes.map(n=>n.elementId),edgeIds:graph.edges.map(e=>e.elementId)});
  const actualNodes=new Map(rows.flatMap(r=>r.graph.nodes).map(n=>[n.elementId,n]));
  const actualEdges=new Map(rows.flatMap(r=>r.graph.relationships).map(e=>[e.elementId,e]));
  for(const node of graph.nodes){const actual=actualNodes.get(node.elementId);assert(actual);assert.equal(node.id,actual.id);assert.deepEqual(node.labels,actual.labels);assert.deepEqual(node.properties,sanitize(actual.properties));}
  for(const edge of graph.edges){const actual=actualEdges.get(edge.elementId);assert(actual);assert.equal(edge.type,actual.type);assert.equal(edge.source,actual.startNode);assert.equal(edge.target,actual.endNode);assert.equal(edge.sourceElementId,actual.startNodeElementId);assert.equal(edge.targetElementId,actual.endNodeElementId);assert.deepEqual(edge.properties,sanitize(actual.properties));}
  if(demo.id==='holdings'){
    assert.equal(graph.nodes.length,8);assert.equal(graph.edges.length,10);assert(graph.nodes.some(n=>n.labels.includes('BuyingUnit')));assert(graph.nodes.some(n=>n.labels.includes('Instrument')));
    const flow=graph.edges.find(e=>e.type==='FLOW_IN_PERIOD'&&e.properties.net_flow_cents===-40000000),before=JSON.stringify(flow);
    const rows=propertyRows(flow);assert.equal(rows.find(r=>r.key==='sales_cents').display,'$200,000.00');assert.equal(rows.find(r=>r.key==='sales_cents').value,'20000000');assert.equal(rows.find(r=>r.key==='redemptions_cents').display,'$600,000.00');assert.equal(JSON.stringify(flow),before);
  }
  report.checks.push({capability:demo.capability,nodes:graph.nodes.length,relationships:graph.edges.length,identities_endpoints_and_properties_match_neo4j:true});console.log('PASS actual Neo4j records:',demo.id);
}
await writeFile(new URL('../graph-provenance-verification.json',import.meta.url),JSON.stringify(report,null,2));
