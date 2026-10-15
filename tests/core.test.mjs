import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateCypher,sanitize} from '../guard.mjs';
import {businessProjection} from '../public/graph.js';
for(const q of ['MATCH (a:Advisor) RETURN a LIMIT 20','WITH "delete; create" AS text RETURN text;','// SET is a comment\nMATCH (a) RETURN a','CALL (a) { MATCH (a)-->(b) RETURN count(b) AS n } RETURN n',"CALL db.index.vector.queryNodes('content_vectors',57,$queryEmbedding) YIELD node,score RETURN node,score"]){test('accepts read query '+q.slice(0,35),()=>assert.doesNotThrow(()=>validateCypher(q)));}
for(const q of ['MATCH (n) DETACH DELETE n','CREATE (n:X) RETURN n','MATCH (n) SET n.flag=1 RETURN n','MATCH (n) RETURN n; MATCH (n) DELETE n','LOAD CSV FROM "https://x" AS row RETURN row','CALL apoc.cypher.run("RETURN 1",{}) YIELD value RETURN value','CALL dbms.listConfig() YIELD name RETURN name','CALL `dbms.security.createUser`("x","y",false) RETURN 1','USE system RETURN 1','MATCH p=(a)-[*]->(b) RETURN p','MATCH p=(a)-[*1..]->(b) RETURN p','RETURN "unterminated','RETURN 1 /* unclosed']){test('blocks unsafe query '+q.slice(0,35),()=>assert.throws(()=>validateCypher(q)));}
test('redacts vectors and credentials from nested result objects',()=>assert.deepEqual(sanitize({embedding:[1,2],password:'hidden',rows:[{api_key:'hidden',name:'Alex'}]}),{rows:[{name:'Alex'}]}));
test('business projection aggregates share classes and preserves financial grain',()=>{
  const nodes=[['a','Advisor'],['b','BuyingUnit'],['i1','Instrument'],['i2','Instrument'],['f','Fund']].map(([id,label])=>({id,labels:[label],properties:{name:id}}));
  const edges=[{id:'m',source:'a',target:'b',type:'MEMBER_OF',properties:{}},...['i1','i2'].flatMap((id,i)=>[{id:'p'+i,source:'b',target:id,type:'POSITION_AS_OF',properties:{assets_cents:1000*(i+1),as_of:'2026-09-29',currency:'USD'}},{id:'f'+i,source:id,target:'f',type:'OF_FUND',properties:{}}])];
  const before=JSON.stringify({nodes,edges}),r=businessProjection({nodes,edges});
  assert.equal(r.nodes.length,2);assert.equal(r.edges.length,1);assert.equal(r.edges[0].properties.assets_cents,3000);assert.deepEqual(r.edges[0].properties.source_relationship_ids,['p0','p1']);assert.equal(JSON.stringify({nodes,edges}),before);
});
