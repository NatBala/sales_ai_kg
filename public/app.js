import {renderSummary,updateSummaryStream} from './summary.js';
import {readEvents} from './stream.js';
import {colors,businessProjection,nodeTitle,edgeTitle,graphNodeLabel,graphEdgeLabel,propertyRows} from './graph.js';
const $=id=>document.getElementById(id);let cy,rawGraph={nodes:[],edges:[]},current=null,busy=false,history=[],summaryController=null;
try{history=JSON.parse(localStorage.getItem('atlas-history')||'[]').slice(0,5);}catch{}
function drawExamples(prompts){$('examples').replaceChildren();for(const [index,p]of prompts.entries()){const b=document.createElement('button');b.type='button';b.className='example';b.dataset.example=p.id;b.title=p.request;const number=document.createElement('span');number.className='example-number';number.textContent=String(index+1).padStart(2,'0');const text=document.createElement('span');const title=document.createElement('strong');title.textContent=p.capability;const question=document.createElement('small');question.textContent=p.question;text.append(title,question);b.append(number,text);b.onclick=()=>ask(p.request,p.id);$('examples').append(b);}}
function drawHistory(){ $('history').replaceChildren();if(!history.length){const e=document.createElement('span');e.className='empty';e.textContent='Your questions will appear here';$('history').append(e);}for(const h of history){const b=document.createElement('button');b.textContent=h.title||h.question;b.title=h.question;b.onclick=()=>ask(h.question);$('history').append(b);}}
drawHistory();
function message(text){$('message').textContent=text;$('message').hidden=!text;}
function setBusy(value,label){busy=value;$('ask-button').disabled=value;$('run-cypher').disabled=value;document.querySelectorAll('.example,.followup,.history button').forEach(b=>b.disabled=value);$('progress').classList.toggle('busy',value);$('progress').textContent=label||(value?'Preparing Cypher and executing in Neo4j…':'Natural language → Cypher → live Neo4j results');$('ask-button').textContent=value?'Exploring…':'Explore graph ↗';}
function cancelSummary(){
  if(summaryController){summaryController.abort();summaryController=null;
    if(current?.summary_agent?.status==='pending'){current={...current,summary_agent:{status:'cancelled'},insights:{summary:'Summary stopped for the previous result. Run the question again to restart it.',insights:[],next_actions:[],follow_up_questions:[]}};renderInsights(current);}
  }
}
async function api(url,body){const r=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed.');return d;}
function activate(tab){document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab));});for(const t of ['graph','table','cypher'])$('view-'+t).hidden=t!==tab;$('graph-toolbar').hidden=tab!=='graph';if(tab==='graph'&&cy){requestAnimationFrame(()=>{cy.resize();cy.fit(undefined,30);});}}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>activate(b.dataset.tab));
function renderGraph(graph){
  rawGraph=graph||{nodes:[],edges:[]};const visible=$('business-view').checked?businessProjection(rawGraph):{...rawGraph,projected:false};
  $('projection-note').hidden=!visible.projected;$('graph-empty').hidden=visible.nodes.length>0;$('selection').hidden=true;
  $('graph-provenance').textContent=`Neo4j · salesfoundation · ${rawGraph.nodes.length} nodes · ${rawGraph.edges.length} relationships returned${current?.graph_truncated?' · Limited result':''}`;
  $('graph-mode').textContent=visible.projected?'Simplified display':'Stored graph';
  $('node-count').textContent=visible.nodes.length;$('edge-count').textContent=visible.edges.length+' connections';
  const types=[...new Set(visible.nodes.map(n=>n.labels[0]))];$('legend').replaceChildren();
  for(const type of types){const s=document.createElement('span'),i=document.createElement('i');i.style.background=colors[type]||'#8d9eb1';s.append(i,document.createTextNode(type==='Employee'?'Salesperson':type));$('legend').append(s);}
  const elements=[...visible.nodes.map(n=>({data:{id:'n'+n.id,label:graphNodeLabel(n),kind:n.labels[0],color:colors[n.labels[0]]||'#8d9eb1',raw:n}})),...visible.edges.map(e=>({data:{id:'e'+e.id,source:'n'+e.source,target:'n'+e.target,label:graphEdgeLabel(e),raw:e}}))];
  if(!cy){cy=window.cytoscape({container:$('graph'),elements:[],minZoom:.15,maxZoom:3,wheelSensitivity:.25,style:[
   {selector:'node',style:{label:'data(label)','background-color':'data(color)',color:'#344f60','font-size':12,'font-family':'Segoe UI, Arial','font-weight':550,'text-valign':'bottom','text-margin-y':9,'text-wrap':'wrap','text-max-width':125,width:38,height:38,'border-width':3,'border-color':'#fff','overlay-opacity':0}},
   {selector:'node[kind="Advisor"]',style:{width:43,height:43}}, {selector:'node[kind="Employee"]',style:{width:54,height:54}},
   {selector:'node[kind="Document"]',style:{shape:'round-rectangle',width:47,height:36}},
   {selector:'edge',style:{width:1.5,'line-color':'#a4bdc1','target-arrow-color':'#a4bdc1','target-arrow-shape':'triangle','arrow-scale':.8,'curve-style':'bezier','control-point-step-size':70,label:'data(label)','font-size':9,color:'#476471','text-wrap':'wrap','text-rotation':'autorotate','text-background-color':'#f9fbfb','text-background-opacity':.95,'text-background-padding':3,'text-margin-y':-5}},
   {selector:':selected',style:{'border-color':'#075f60','border-width':4,'line-color':'#087e7b','target-arrow-color':'#087e7b'}},
   {selector:'.faded',style:{opacity:.2}},{selector:'.highlighted',style:{'line-color':'#3a9b90','target-arrow-color':'#3a9b90'}}
  ]});cy.on('tap','node,edge',ev=>select(ev.target));}
  cy.elements().remove();cy.add(elements);layout();drawInspector(visible);
}
function layout(){
  if(!cy||!cy.nodes().length)return;cy.resize();
  const financial=cy.nodes('[kind="Advisor"]').length===1&&cy.nodes().every(n=>['Advisor','BuyingUnit','Instrument','Fund'].includes(n.data('kind')))&&cy.nodes('[kind="BuyingUnit"]').length===1;
  if(financial){
    // Positions only: retain every stored node and edge, with readable layers.
    const positions=new Map(),width=cy.width(),height=cy.height(),row=i=>48+i*(height-112)/3;
    positions.set(cy.nodes('[kind="Advisor"]')[0].id(),{x:width/2,y:row(0)});positions.set(cy.nodes('[kind="BuyingUnit"]')[0].id(),{x:width/2,y:row(1)});
    const instruments=cy.nodes('[kind="Instrument"]');instruments.forEach((node,i)=>positions.set(node.id(),{x:instruments.length===1?width/2:75+i*(width-150)/(instruments.length-1),y:row(2)}));
    cy.nodes('[kind="Fund"]').forEach(node=>{const sources=node.incomers('edge').filter(e=>e.data('raw').type==='OF_FUND').sources().map(n=>positions.get(n.id())?.x).filter(Number.isFinite);positions.set(node.id(),{x:sources.length?sources.reduce((a,b)=>a+b,0)/sources.length:width/2,y:row(3)});});
    cy.layout({name:'preset',positions:n=>positions.get(n.id()),fit:true,padding:30,animate:false}).run();
  }else cy.layout({name:'cose',animate:false,randomize:false,nodeRepulsion:14000,idealEdgeLength:110,edgeElasticity:90,gravity:.5,numIter:750,nodeDimensionsIncludeLabels:true,componentSpacing:100,padding:40}).run();
}
function drawInspector(graph){
  const picker=$('element-picker');picker.replaceChildren();const names=new Map(graph.nodes.map(n=>[n.id,nodeTitle(n)]));
  for(const [label,items]of [['Nodes',graph.nodes],['Relationships',graph.edges]]){const group=document.createElement('optgroup');group.label=label;for(const item of items){const option=document.createElement('option');option.value=(label==='Nodes'?'n':'e')+item.id;option.textContent=label==='Nodes'?`${nodeTitle(item)} · :${item.labels.join(' :')}`:`${item.type} · ${names.get(item.source)} → ${names.get(item.target)}`;group.append(option);}picker.append(group);}
  picker.disabled=!graph.nodes.length;$('selection-empty').hidden=Boolean(graph.nodes.length);
  if(!graph.nodes.length){$('selection').hidden=true;$('selection-origin').textContent='No graph elements';return;}
  const initial=graph.nodes.find(n=>n.labels.includes('Advisor'))||graph.nodes[0];select(cy.getElementById('n'+initial.id));
}
function select(element){
  if(!element?.length)return;const raw=element.data('raw'),isNode=element.isNode(),projection=Boolean(raw.properties.projection);
  $('selection').hidden=false;$('selection-empty').hidden=true;$('element-picker').value=element.id();
  $('selection-origin').textContent=projection?'Display projection':isNode?'Stored node':'Stored relationship';
  $('selection-title').textContent=isNode?nodeTitle(raw):raw.type;
  const names=new Map(rawGraph.nodes.map(n=>[n.id,nodeTitle(n)]));
  $('selection-endpoints').textContent=isNode?raw.labels.map(label=>':'+label).join(' '):`${names.get(raw.source)} → ${names.get(raw.target)}`;
  $('identity-label').textContent=projection?'Display ID':raw.elementId?'Neo4j elementId':'Neo4j internal ID';
  $('selection-identity').textContent=raw.elementId||raw.id;$('selection-properties').replaceChildren();
  for(const row of propertyRows(raw)){const d=document.createElement('div');d.className='property';const key=document.createElement('span');key.className='key';key.textContent=row.key;const val=document.createElement('span');val.className='value';val.textContent=row.display||row.value;d.append(key,val);if(row.display){const stored=document.createElement('small');stored.className='stored-value';stored.textContent='Stored: '+row.value+' cents';d.append(stored);}$('selection-properties').append(d);}
  $('selection-highlights').replaceChildren();
  for(const [key,label]of [['assets_cents','Assets'],['sales_cents','Sales'],['redemptions_cents','Redemptions'],['net_flow_cents','Net flow']]){
    const row=propertyRows(raw).find(p=>p.key===key);if(!row)continue;const card=document.createElement('div'),caption=document.createElement('span'),value=document.createElement('strong');caption.textContent=label;value.textContent=row.display;card.append(caption,value);$('selection-highlights').append(card);
  }
  $('selection-json').textContent=JSON.stringify(raw,null,2);
  cy.elements().unselect().removeClass('faded highlighted');element.select();const keep=isNode?element.closedNeighborhood():element.union(element.connectedNodes());keep.edges().addClass('highlighted');
}
$('element-picker').onchange=()=>select(cy?.getElementById($('element-picker').value));
function valueText(v,column){if(v===null||v===undefined)return '—';if(typeof v==='number'){if(/USD$/i.test(column))return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);if(/pct|percent/i.test(column))return v.toFixed(2)+'%';return new Intl.NumberFormat('en-US',{maximumFractionDigits:4}).format(v);}if(typeof v==='object')return JSON.stringify(v,null,2);return String(v);}
function renderTable(data){$('row-count').textContent=data.rows?.length||0;$('table-wrap').replaceChildren();if(!data.rows?.length){const p=document.createElement('p');p.className='empty-copy';p.textContent='No matching records. Try a different question or reporting period.';$('table-wrap').append(p);return;}const table=document.createElement('table');const head=document.createElement('thead');const hr=document.createElement('tr');for(const name of ['#',...data.columns]){const th=document.createElement('th');th.textContent=name.replaceAll('_',' ');hr.append(th);}head.append(hr);table.append(head);const body=document.createElement('tbody');data.rows.forEach((row,index)=>{const tr=document.createElement('tr');tr.dataset.row=index+1;for(const [name,value]of [['#',index+1],...data.columns.map(k=>[k,row[k]])]){const td=document.createElement('td');const val=valueText(value,name);if(typeof value==='object'&&value!==null){const pre=document.createElement('pre');pre.textContent=val;td.append(pre);}else td.textContent=val;tr.append(td);}body.append(tr);});table.append(body);$('table-wrap').append(table);}
function focusEvidence(ref){
  if(ref.startsWith('row:')){
    const index=Number(ref.slice(4));activate('table');document.querySelectorAll('tr.highlight').forEach(r=>r.classList.remove('highlight'));
    const row=document.querySelector(`[data-row="${index}"]`);row?.classList.add('highlight');row?.scrollIntoView({block:'center',behavior:'smooth'});return;
  }
  activate('graph');const prefix=ref.startsWith('node:')?'n':'e',id=ref.slice(ref.indexOf(':')+1);
  let element=cy?.getElementById(prefix+id);
  if(!element?.length){$('business-view').checked=false;renderGraph(rawGraph);element=cy?.getElementById(prefix+id);}
  if(element?.length){select(element);$('selection').scrollIntoView({block:'nearest',behavior:'smooth'});}
}
function renderInsights(data){renderSummary(data,{onEvidence:focusEvidence,onQuestion:ask});}
async function finishSummary(data){
  if(!data.result_id||data.summary_agent?.status!=='pending')return;
  const controller=new AbortController();summaryController=controller;let text='',complete=false;
  const isCurrent=()=>!controller.signal.aborted&&current?.result_id===data.result_id;
  try{
    // Yield for an actual graph paint before starting the independent summary request.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(!isCurrent())return;
    const response=await fetch('/api/summarize/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({result_id:data.result_id}),signal:controller.signal});
    if(!response.ok)throw new Error('Summary unavailable.');
    await readEvents(response.body,event=>{
      if(!isCurrent()||event.result_id!==data.result_id)return;
      if(event.type==='summary_delta'){text+=event.delta;updateSummaryStream(text);$('progress').textContent='Graph ready · Summary is streaming';}
      else if(event.type==='complete'){complete=true;current={...current,...event.result};renderInsights(current);$('progress').textContent=event.result.summary_agent.status==='unavailable'?'Graph ready · Summary unavailable':'Graph ready · Summary complete';}
      else if(event.type==='error')throw new Error(event.message);
    });
    if(!complete&&!controller.signal.aborted)throw new Error('Summary stream ended early.');
  }catch{if(isCurrent()){current={...current,summary_agent:{status:'unavailable'},insights:{summary:'The summary agent is unavailable. Your graph and query results are ready to explore.',insights:[],next_actions:[],follow_up_questions:[]}};renderInsights(current);$('progress').textContent='Graph ready · Summary unavailable';}}
  finally{if(summaryController===controller)summaryController=null;}
}
function renderResult(data){current=data;$('result-kicker').textContent=data.embedding_used?'EMBEDDING SEARCH · LIVE GRAPH':data.planning_mode==='preset'?'VERIFIED DEMO · LIVE NEO4J':data.query_template&&data.query_template!=='custom'?'OPENAI PLAN · VERIFIED CYPHER':'GENERATED CYPHER · LIVE RESULTS';$('result-title').textContent=data.title||'Cypher results';$('result-description').textContent=data.description||'Results returned directly from Neo4j.';$('result-time').textContent=data.elapsed_ms!=null?'Graph ready in '+(data.elapsed_ms<1000?Math.round(data.elapsed_ms)+'ms':(data.elapsed_ms/1000).toFixed(1)+'s'):'';$('cypher-editor').value=data.cypher||'';$('graph-query').textContent=data.graph_cypher||'The answer query provides this graph.';$('query-parameters').textContent=JSON.stringify(data.parameters||{},null,2)+(data.embedding_used?'\nqueryEmbedding: 384-dimensional local MiniLM vector (kept on server)':'');renderTable(data);renderInsights(data);activate('graph');renderGraph(data.graph);requestAnimationFrame(()=>document.querySelector('.result-main').scrollIntoView({block:'start',behavior:'instant'}));}
async function ask(question,exampleId){if(busy)return;question=question.trim();if(!question)return;cancelSummary();$('question').value=question;message('');setBusy(true,exampleId==='embeddings'?'Creating the search embedding and querying Neo4j…':exampleId?'Executing verified Cypher in Neo4j…':undefined);let result;try{const data=await api('/api/ask',{question,example_id:exampleId,history,defer_summary:true});if(data.clarification){message(data.clarification);return;}renderResult(data);result=data;history=[{question,title:data.title},...history.filter(h=>h.question!==question)].slice(0,5);try{localStorage.setItem('atlas-history',JSON.stringify(history));}catch{}drawHistory();}catch(e){message(e.message);}finally{setBusy(false,result?'Graph ready · Starting summary…':undefined);}if(result)void finishSummary(result);}
$('ask-form').onsubmit=e=>{e.preventDefault();ask($('question').value);};$('question').onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();ask($('question').value);}};
$('business-view').onchange=()=>renderGraph(rawGraph);$('fit').onclick=()=>cy?.fit(undefined,55);$('relayout').onclick=layout;$('zoom-in').onclick=()=>cy?.zoom(cy.zoom()*1.25);$('zoom-out').onclick=()=>cy?.zoom(cy.zoom()/1.25);
$('download').onclick=()=>{if(!cy)return;const a=document.createElement('a');a.download='advisor-atlas-graph.png';a.href=cy.png({bg:'#f9fbfb',full:true,scale:2});a.click();};
$('copy-query').onclick=async()=>{try{await navigator.clipboard.writeText($('cypher-editor').value);$('copy-query').textContent='Copied';setTimeout(()=>$('copy-query').textContent='Copy',1500);}catch{message('Select and copy the query from the editor.');}};
$('run-cypher').onclick=async()=>{if(busy)return;cancelSummary();message('');setBusy(true,'Executing Cypher in Neo4j…');let result;try{const query=$('cypher-editor').value;if(query.includes('$queryEmbedding'))throw new Error('For semantic queries, use Explore graph so the server can create the matching query embedding.');const data=await api('/api/run',{cypher:query,parameters:current?.parameters||{},defer_summary:true});renderResult(data);result=data;}catch(e){message(e.message);}finally{setBusy(false,result?'Graph ready · Starting summary…':undefined);}if(result)void finishSummary(result);};
$('new-exploration').onclick=()=>{$('question').value='';$('question').focus();message('');};
window.addEventListener('resize',()=>{cy?.resize();});
try{const data=await api('/api/bootstrap');drawExamples(data.examples);$('status').textContent='● Connected · Read only';$('sidebar-connection').textContent=data.database;$('model-label').textContent=data.model+' · Neo4j';$('cypher-editor').value=data.cypher;renderGraph(data.graph);$('row-count').textContent='—';}catch(e){$('status').textContent='Connection unavailable';$('sidebar-connection').textContent='Database offline';message(e.message);}
