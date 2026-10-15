import {nodeTitle,edgeTitle} from './graph.js';
const $=id=>document.getElementById(id);
function el(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text)e.textContent=text;return e;}
const prose=text=>String(text||'').replace(/\s*[\[(](?:\s*(?:row|node|edge):[\w:-]+\s*[,;]?\s*)+[\])]/g,'');
export function updateSummaryStream(text){
  $('agent-summary').dataset.status='streaming';$('agent-status').textContent='Writing…';
  $('agent-summary-text').textContent=prose(text);
  $('agent-scope').textContent='Live draft · Evidence references appear when the summary finishes';
}

export function renderSummary(data,{onEvidence,onQuestion}){
  const agent=data.summary_agent||{status:'pending'},info=data.insights||{},pending=agent.status==='pending';
  $('agent-summary').hidden=false;$('agent-summary').dataset.status=agent.status;
  $('agent-status').textContent={pending:'Starting…',complete:'Complete',empty:'No matches',unavailable:'Unavailable',cancelled:'Stopped'}[agent.status]||agent.status;
  $('agent-status').setAttribute('aria-busy',String(pending));
  $('agent-summary-text').textContent=pending?'Your graph is ready. The summary will stream here while you explore it.':prose(info.summary)||'No summary was returned.';
  const coverage=agent.coverage;
  $('agent-scope').textContent=coverage?`Synthetic demo · ${coverage.reviewed_rows} rows · ${coverage.reviewed_nodes} nodes · ${coverage.reviewed_relationships} relationships reviewed${coverage.partial?' · Partial evidence':''} · ${agent.model||'OpenAI'} · ${(agent.elapsed_ms/1000).toFixed(1)}s`:'Automatic after every query · Uses the returned graph and results';
  const label=ref=>{
    if(ref.startsWith('row:'))return 'Result '+ref.slice(4);
    if(ref.startsWith('node:')){const n=data.graph?.nodes.find(n=>'node:'+n.id===ref);return n?nodeTitle(n):'Node';}
    const edge=data.graph?.edges.find(e=>'edge:'+e.id===ref);return edge?edgeTitle(edge):'Relationship';
  };
  const citations=(target,refs)=>{for(const ref of (refs||[]).slice(0,5)){const b=el('button','evidence-link',label(ref)+' ↗');b.title='Inspect supporting '+ref;b.onclick=()=>onEvidence(ref);target.append(b);}};
  $('agent-evidence').replaceChildren();citations($('agent-evidence'),info.summary_evidence_refs);
  const target=$('insights');target.replaceChildren();
  if(pending){target.append(el('p','summary','Findings and suggested follow-ups will appear after the agent finishes. You can explore the graph now.'));return;}
  for(const finding of info.insights||[]){const card=el('div','insight-card');card.append(el('h3','',finding.title));if(finding.kind==='inference')card.append(el('span','inference-tag','Inference'));card.append(el('p','',prose(finding.detail)));citations(card,finding.evidence_refs);target.append(card);}
  if(info.next_actions?.length){target.append(el('h3','actions-heading','Suggested next steps'));for(const action of info.next_actions){const card=el('div','next-action');card.append(el('strong','',action.action),el('p','',action.reason));citations(card,action.evidence_refs);target.append(card);}}
  if(info.caveat)target.append(el('p','caveat',info.caveat));
  if(!(info.insights?.length||info.next_actions?.length)&&!['unavailable','cancelled'].includes(agent.status))target.append(el('p','summary',info.summary||'No additional findings.'));
  for(const question of info.follow_up_questions||[]){const b=el('button','followup',question+' ↗');b.onclick=()=>onQuestion(question);target.append(b);}
}
