import {test} from 'node:test';import assert from 'node:assert/strict';
import {prepareEvidence,runSummaryAgent} from '../summary-agent.mjs';
const result={question:'What does Alex hold?',cypher:'MATCH p=(a)-->(f) RETURN p',columns:['Assets_USD'],rows:[{Assets_USD:4200000,embedding:[1,2],password:'hidden'}],graph:{nodes:[{id:'a',labels:['Advisor'],properties:{name:'Alex'}},{id:'f',labels:['Fund'],properties:{name:'GFA',embedding:[3,4]}}],edges:[{id:'p',source:'a',target:'f',type:'POSITION_AS_OF',properties:{assets_cents:420000000,currency:'USD',as_of:'2026-09-29'}}]}};
const output={summary:'Alex has $4.2 million in GFA.',summary_evidence_refs:['edge:p'],insights:[{title:'GFA position',detail:'Assets are $4.2 million.',kind:'fact',evidence_refs:['row:1','edge:p']}],next_actions:[],follow_up_questions:[],limitations:[]};
test('agent receives real graph relationships alongside rows and strips vectors/secrets',async()=>{
 const r=await runSummaryAgent(result,async(instructions,input,format)=>{const e=JSON.parse(input);assert.equal(e.relationships[0].properties.assets_cents,420000000);assert.equal(e.nodes[0].ref,'node:a');assert(!input.includes('"embedding"'));assert(!input.includes('hidden'));assert(instructions.includes('UNTRUSTED DATA'));assert.equal(format.name,'graph_summary_agent');return output;},'test-model');
 assert.equal(r.summary_agent.status,'complete');assert.deepEqual(r.insights.insights[0].evidence_rows,[1]);assert.equal(r.summary_agent.coverage.reviewed_relationships,1);
});
test('bounded evidence stays valid JSON and explicitly reports partial coverage',()=>{
 const large={...result,rows:Array.from({length:80},(_,i)=>({index:i,text:'x'.repeat(5000)}))};const e=prepareEvidence(large);assert(e.coverage.partial);assert.equal(e.coverage.returned_rows,80);assert(e.coverage.reviewed_rows<35);assert.doesNotThrow(()=>JSON.parse(JSON.stringify(e)));assert.equal(e.rows[0].ref,'row:1');
});
test('unsupported findings and actions are omitted rather than linked to invented evidence',async()=>{
 const r=await runSummaryAgent(result,async()=>({...output,insights:[...output.insights,{title:'Invented',detail:'Bad',kind:'fact',evidence_refs:['row:1','node:missing']}],next_actions:[{action:'Invented',reason:'Bad',evidence_refs:['row:99']}]}),'test');assert.equal(r.insights.insights.length,1);assert.equal(r.insights.next_actions.length,0);assert.match(r.insights.caveat,/omitted/);
});
test('invalid summary references cause an explicit unavailable fallback',async()=>{
 const r=await runSummaryAgent(result,async()=>({...output,summary_evidence_refs:['node:missing']}),'test');assert.equal(r.summary_agent.status,'unavailable');assert(!r.insights.summary.includes('$4.2'));
});
test('OpenAI failure leaves original graph and results usable',async()=>{
 const before=JSON.stringify(result);const r=await runSummaryAgent(result,async()=>{throw new Error('timeout');},'test');assert.equal(r.summary_agent.status,'unavailable');assert.match(r.insights.summary,/results remain available/);assert.equal(JSON.stringify(result),before);
});
test('empty result does not make an unnecessary model call',async()=>{
 const r=await runSummaryAgent({rows:[],graph:{nodes:[],edges:[]}},()=>{throw new Error('Must not call');},'test');assert.equal(r.summary_agent.status,'empty');assert.match(r.insights.summary,/No matching/);
});
test('follow-up questions cannot suggest unavailable historical data',async()=>{
 const r=await runSummaryAgent(result,async()=>({...output,follow_up_questions:['Show historical trends since 2020.','How many advisors does each salesperson cover?']}),'test');assert.deepEqual(r.insights.follow_up_questions,['How many advisors does each salesperson cover?']);
});
