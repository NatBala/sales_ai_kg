export function stripLiterals(query) {
  let out='',i=0;
  while(i<query.length){
    const c=query[i],next=query[i+1];
    if(c==='/'&&next==='/'){while(i<query.length&&query[i]!=='\n')i++;out+=' ';continue;}
    if(c==='/'&&next==='*'){const end=query.indexOf('*/',i+2);if(end<0)throw new Error('Unclosed comment.');i=end+2;out+=' ';continue;}
    if(c==='"'||c==="'"||c==='`'){
      const quote=c;out+=quote==='`'?' __QUOTED_IDENTIFIER__ ':' ';i++;let closed=false;
      while(i<query.length){if(query[i]==='\\'){i+=2;continue;}if(query[i]===quote){if(query[i+1]===quote){i+=2;continue;}i++;closed=true;break;}i++;}
      if(!closed)throw new Error('Unclosed quoted value.');continue;
    }
    out+=c;i++;
  }return out;
}
export function validateCypher(query){
  if(typeof query!=='string'||!query.trim()||query.length>18000)throw new Error('Provide one read-only Cypher query (up to 18,000 characters).');
  const clean=query.trim().replace(/;\s*$/,'');const code=stripLiterals(clean);
  if(code.includes(';'))throw new Error('Only one query may run at a time.');
  if(!/^\s*(MATCH|OPTIONAL\s+MATCH|WITH|CALL|UNWIND|RETURN)\b/i.test(code))throw new Error('Use a read-only MATCH, WITH, CALL subquery, UNWIND, or RETURN query.');
  if(/\b(CREATE|MERGE|INSERT|SET|DELETE|DETACH|DROP|REMOVE|FOREACH|ALTER|GRANT|REVOKE|DENY|TERMINATE|START|STOP|LOAD|USE|SHOW|DBMS|PROFILE|EXPLAIN|CYPHER|TRANSACTIONS)\b/i.test(code))throw new Error('Only read-only graph queries are allowed.');
  for(const match of code.matchAll(/\bCALL\s+([^({\s][\w.]*)/gi))if(match[1].toLowerCase()!=='db.index.vector.querynodes')throw new Error('Only the content vector search procedure is allowed.');
  if(/\[\s*[^\]]*\*\s*(?:\]|\d+\s*\.\.\s*\])/.test(code))throw new Error('Use bounded graph traversals.');
  if(/\bAPOC\s*\./i.test(code))throw new Error('APOC execution is not enabled.');
  return clean;
}
export function sanitize(value,depth=0){
  if(depth>9)return '[nested value]';
  if(typeof value==='string')return value.length>6000?value.slice(0,6000)+'…':value;
  if(Array.isArray(value))return value.slice(0,120).map(v=>sanitize(v,depth+1));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['embedding','embedding_input','password','api_key','OPENAI_API_KEY'].includes(k)).map(([k,v])=>[k,sanitize(v,depth+1)]));
  return value;
}
