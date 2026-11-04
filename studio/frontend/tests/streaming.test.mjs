import test from 'node:test';
import assert from 'node:assert/strict';
import { createSSEParser, consumeSSE, postSSE } from '../src/lib/sse.ts';
import { streamProvider, parseRunRequest } from '../src/lib/provider-stream.ts';
import { applyEvent, responseStatus, observations } from '../src/lib/run-diagnostics.ts';

const req = {provider:'openai',model:'gpt-4o',scaffold_text:'',ask_prompt:'Hello',api_key:'test-key-never-persist',max_tokens:32};
const chunk = (p) => 'data: ' + JSON.stringify(p) + '\r\n\r\n';
const sse = (text) => new Response(text,{headers:{'content-type':'text/event-stream','x-request-id':'req-test'}});
const runProvider = async (response, request = req) => {
  const events=[]; let sent;
  await streamProvider(request,e=>events.push(e),new AbortController().signal, async(url, options)=>{sent={url,body:JSON.parse(options.body)};return response;});
  return {events,sent};
};

test('SSE handles every byte boundary, CRLF, bare CR, comments and multi-line data',()=>{
  const frames=[]; const parser=createSSEParser(f=>frames.push(f));
  for(const char of ': ping\r\nevent: pipeline\r\ndata: {"phase":\r\ndata: "tokens"}\r\n\r\ndata: second\r\rdata: final') parser.feed(char);
  parser.finish();
  assert.deepEqual(frames,[{event:'pipeline',data:'{"phase":\n"tokens"}'},{event:'message',data:'second'},{event:'message',data:'final'}]);
});

test('UTF-8 split across network chunks is retained',async()=>{
  const bytes=new TextEncoder().encode('data: नमस्ते 🌍\n\n');const frames=[];
  await consumeSSE(new ReadableStream({start(c){for(const byte of bytes)c.enqueue(Uint8Array.of(byte));c.close();}}),f=>frames.push(f));
  assert.equal(frames[0].data,'नमस्ते 🌍');
});

test('OpenAI streams text before completion and accepts empty choices in usage frame',async()=>{
  const {events,sent}=await runProvider(sse(chunk({id:'chat-1',model:'gpt-4o',choices:[{delta:{content:'Hello '},finish_reason:null}]})+chunk({choices:[{delta:{content:'world'},finish_reason:'stop'}]})+chunk({choices:[],usage:{prompt_tokens:4,completion_tokens:2}})+'data: [DONE]\n\n'));
  assert.equal(sent.body.stream,true);assert.equal(sent.body.max_completion_tokens,32);
  assert.equal(events.filter(e=>e.phase==='tokens').map(e=>e.payload.delta).join(''),'Hello world');
  assert.ok(events.findIndex(e=>e.phase==='tokens')<events.findIndex(e=>e.phase==='generation_end'));
  assert.equal(events.at(-1).payload.usage.completion_tokens,2);
  assert.equal(events.at(-1).payload.request_id,'req-test');
  assert.equal(events.at(-1).payload.verdict,'completed');
  assert.ok(events.every(e=>!e.phase.startsWith('gate_')));
});

test('HTTP errors retain status/code and redact the API key; no EMPTY verdict',async()=>{
  const {events}=await runProvider(new Response(JSON.stringify({error:{message:'Invalid '+req.api_key,code:'invalid_api_key'}}),{status:401,headers:{'x-request-id':'failed'}}));
  const error=events.at(-1);
  assert.equal(error.phase,'error');assert.equal(error.payload.http_status,401);assert.equal(error.payload.error_code,'invalid_api_key');
  assert.ok(!JSON.stringify(events).includes(req.api_key));assert.ok(!events.some(e=>e.phase==='verdict'));
});

test('refusal delta and content filter remain provider observations',async()=>{
  const {events}=await runProvider(sse(chunk({choices:[{delta:{refusal:'Declined'},finish_reason:'stop'}]})+'data: [DONE]\n\n'));
  assert.equal(events.find(e=>e.phase==='tokens').payload.delta,'Declined');assert.equal(events.at(-1).payload.verdict,'refusal');
  assert.equal(responseStatus('', 'content_filter'), 'filtered');
  assert.equal(responseStatus('', 'length'), 'truncated');
  assert.equal(responseStatus('', 'stop'), 'empty');
});

test('premature EOF and mid-stream provider errors preserve partial text',async()=>{
  for (const suffix of ['',chunk({error:{message:'overloaded'}})]) {
    const {events}=await runProvider(sse(chunk({choices:[{delta:{content:'partial'}}]})+suffix));
    assert.equal(events.at(-1).phase,'error');
    let run={text:'',events:[],status:'running'};
    for (const e of events)run=applyEvent(run,e);
    assert.equal(run.text,'partial');assert.equal(run.status,'error');
  }
});

test('Anthropic merges usage and streams text without exposing thinking',async()=>{
  const {events}=await runProvider(sse(chunk({type:'message_start',message:{id:'msg-1',model:'claude-test',usage:{input_tokens:3}}})+chunk({type:'content_block_delta',delta:{type:'thinking_delta',thinking:'private'}})+chunk({type:'content_block_delta',delta:{type:'text_delta',text:'Hello'}})+chunk({type:'message_delta',delta:{stop_reason:'end_turn'},usage:{output_tokens:2}})+chunk({type:'message_stop'})),{...req,provider:'anthropic'});
  assert.equal(events.at(-1).payload.usage.input_tokens,3);assert.equal(events.at(-1).payload.usage.output_tokens,2);
  assert.equal(events.filter(e=>e.phase==='tokens').length,1);assert.ok(!JSON.stringify(events).includes('private'));
});

test('consecutive token events are bounded and text heuristics do not claim a layer',()=>{
  let run={text:'',events:[],status:'running'};
  for(let i=0;i<10000;i++)run=applyEvent(run,{phase:'tokens',t:i/100,payload:{delta:'a'}});
  assert.equal(run.events.length,1);assert.equal(run.text.length,10000);
  run.text="I cannot help with that.";
  assert.ok(observations(run).some(x=>x.kind==='estimate'));
  assert.ok(observations(run).some(x=>x.label==='Internal refusal layer'&&x.kind==='unknown'));
});

test('validation rejects unknown provider, key line breaks and unbounded tokens',()=>{
  for(const invalid of [{provider:'http://localhost'}, {api_key:'a\nb'}, {max_tokens:100000}, {max_tokens:NaN}, {model:''}, {ask_prompt:''}])assert.throws(()=>parseRunRequest({...req,...invalid}));
  assert.equal(parseRunRequest(req).model,'gpt-4o');
});

test('postSSE rejects HTML success responses rather than silently returning EMPTY',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response('<html>proxy</html>',{headers:{'content-type':'text/html'}});
  try {await assert.rejects(postSSE('https://example.test',{},()=>{}),/did not return an event stream/);}finally{globalThis.fetch=original;}
});
