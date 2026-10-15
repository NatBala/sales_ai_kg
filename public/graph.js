export const colors={Advisor:'#627bcb',Employee:'#225c69',Fund:'#16a58b',Instrument:'#83c6b1',BuyingUnit:'#9dafce',Document:'#d6995c',DocumentVersion:'#dfbf98',ContentChunk:'#cbad86',Topic:'#a2b965',Statement:'#b88daf',Interaction:'#b190c0',Firm:'#588498',Category:'#9aaf67',Platform:'#819caf',AssetClass:'#a5bd6e',Meeting:'#b798c9'};
export function businessProjection(graph){
  const nodes=new Map(graph.nodes.map(n=>[n.id,n]));const financial=graph.edges.filter(e=>['POSITION_AS_OF','FLOW_IN_PERIOD'].includes(e.type));
  const removedEdges=new Set(),collapseNodes=new Set(),added=new Map();
  for(const edge of financial){
    const members=graph.edges.filter(e=>e.type==='MEMBER_OF'&&e.target===edge.source);const ofFund=graph.edges.find(e=>e.type==='OF_FUND'&&e.source===edge.target);
    if(!members.length||!ofFund)continue;
    for(const member of members){
      const p=edge.properties;const key=[member.source,ofFund.target,edge.type,p.currency,p.as_of,p.period_start,p.period_end].join('|');
      if(!added.has(key))added.set(key,{id:'projection:'+key,source:member.source,target:ofFund.target,type:edge.type==='POSITION_AS_OF'?'HOLDS':'FLOWS',properties:{...p,projection:'Advisor → BuyingUnit → Instrument → Fund',source_relationship_ids:[],share_classes:[]}});
      const projected=added.get(key);if(projected.properties.source_relationship_ids.length)for(const f of ['assets_cents','sales_cents','redemptions_cents','net_flow_cents'])if(Number.isFinite(p[f]))projected.properties[f]=(projected.properties[f]||0)+p[f];
      projected.properties.source_relationship_ids.push(edge.id);projected.properties.share_classes.push(nodes.get(edge.target)?.properties.ticker||edge.target);
    }
    removedEdges.add(edge.id);removedEdges.add(ofFund.id);members.forEach(m=>removedEdges.add(m.id));collapseNodes.add(edge.source);collapseNodes.add(edge.target);
  }
  const kept=graph.edges.filter(e=>!removedEdges.has(e.id));
  // Keep a book/share class when it still participates in another visible relationship.
  const referenced=new Set(kept.flatMap(e=>[e.source,e.target]));
  return {nodes:graph.nodes.filter(n=>!collapseNodes.has(n.id)||referenced.has(n.id)),edges:[...kept,...added.values()],projected:added.size>0};
}
export function nodeTitle(n){return n.labels.includes('Advisor')||n.labels.includes('Employee')?n.properties.full_name||n.properties.name:n.properties.name||n.properties.id||n.labels[0];}
export function edgeTitle(e){const p=e.properties;const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:p.currency||'USD',notation:'compact',maximumFractionDigits:2}).format(n/100);if(['HOLDS','POSITION_AS_OF'].includes(e.type)&&Number.isFinite(p.assets_cents))return money(p.assets_cents);if(['FLOWS','FLOW_IN_PERIOD'].includes(e.type)&&Number.isFinite(p.net_flow_cents))return 'Net '+money(p.net_flow_cents);if(e.type==='VISITED_PAGE')return p.visit_count+' visits';return e.type.toLowerCase().replaceAll('_',' ');}
export function graphNodeLabel(node){return nodeTitle(node)+'\n:'+node.labels.join(' :');}
export function graphEdgeLabel(edge){const value=edgeTitle(edge);return edge.type+(value===edge.type.toLowerCase().replaceAll('_',' ')?'':'\n'+value);}
export function propertyRows(raw){
  return Object.entries(raw.properties||{}).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>({
    key,value:typeof value==='object'?JSON.stringify(value,null,2):String(value),
    display:key.endsWith('_cents')&&typeof value==='number'?new Intl.NumberFormat('en-US',{style:'currency',currency:raw.properties.currency||'USD'}).format(value/100):''
  }));
}
