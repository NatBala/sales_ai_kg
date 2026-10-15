import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readEvents,summaryPrefix} from '../public/stream.js';
const bytes=new TextEncoder();
function stream(parts){return new ReadableStream({start(c){for(const part of parts)c.enqueue(part);c.close();}});}
test('SSE survives single-byte UTF-8 chunks, CRLF, comments, multiple events and multiline data',async()=>{
  const raw=': heartbeat\r\n\r\nevent: delta\r\ndata: {"delta":"Alex’s €"}\r\n\r\ndata: {"type":\n'+'data: "complete"}\n\ndata: [DONE]\n\n';
  const events=[];await readEvents(stream([...bytes.encode(raw)].map(x=>new Uint8Array([x]))),x=>events.push(x));
  assert.deepEqual(events,[{delta:'Alex’s €'},{type:'complete'}]);
});
test('truncated stream frames are rejected',async()=>{
  await assert.rejects(()=>readEvents(stream([bytes.encode('data: {"type":"complete"}')]),()=>{}),/mid-frame/);
});
test('summary extraction handles every boundary including quotes, escapes and unicode pairs',()=>{
  const raw='{"summary":"Alex says \\"hello\\".\\nAssets: $4.2M \\uD83D\\uDCCA","insights":[]}'.replaceAll('\\\\','\\');
  const expected=JSON.parse(raw).summary;let last='';
  for(let n=0;n<=raw.length;n++){const text=summaryPrefix(raw.slice(0,n));assert(expected.startsWith(text));assert(text.startsWith(last));last=text;}
  assert.equal(last,expected);
});
test('summary extraction never displays trailing JSON or an unrelated field',()=>{
  assert.equal(summaryPrefix('{"summary":"Ready","secret":"hidden"}'),'Ready');
  assert.equal(summaryPrefix('{"other":"ignore","summary":"later"}'),'');
});
test('stream errors cancel the reader',async()=>{
  let cancelled=false;
  const input=new ReadableStream({start(c){c.enqueue(bytes.encode('data: {"type":"error"}\n\n'));},cancel(){cancelled=true;}});
  await assert.rejects(()=>readEvents(input,()=>{throw new Error('Provider failed');}),/Provider failed/);
  assert(cancelled);
});
