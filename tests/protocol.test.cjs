const test = require('node:test');
const assert = require('node:assert/strict');
const { CodexRpcClient } = require('../content/protocol.js');

function fixture(handler) {
  let callbacks, launches = 0;
  const writes = [];
  const deliver = obj => callbacks.onChunk(JSON.stringify(obj) + '\n');
  const client = new CodexRpcClient({ transportFactory: async cb => {
    callbacks = cb; launches++;
    return {
      write: async text => {
        const m = JSON.parse(text); writes.push(m);
        if (m.method === 'initialize') deliver({ id: m.id, result: { userAgent: 'test' } });
        else if (m.id && handler) handler(m, deliver, cb);
      },
      close: async () => {},
    };
  }});
  return { client, writes, deliver, get callbacks() { return callbacks; }, get launches() { return launches; } };
}

test('one initialization for concurrent callers; JSONL chunk fragmentation', async () => {
  const f = fixture((m, deliver, cb) => {
    const reply = JSON.stringify({id:m.id,result:{value:'中文'}})+'\n';
    cb.onChunk(reply.slice(0,7)); cb.onChunk(reply.slice(7,17)); cb.onChunk(reply.slice(17));
  });
  await Promise.all([f.client.connect(),f.client.connect()]);
  assert.equal(f.launches,1); assert.equal(f.writes.filter(m=>m.method==='initialize').length,1);
  assert.deepEqual(await f.client.request('example',{}),{value:'中文'});
  await f.client.close();
});

test('server response error reaches caller', async () => {
  const f = fixture((m,deliver)=>deliver({id:m.id,error:{code:-32602,message:'bad params'}}));
  await f.client.connect(); await assert.rejects(f.client.request('bad',{}),/bad params/); await f.client.close();
});

test('stream uses authoritative message; ignores other threads and commentary', async () => {
  const f = fixture((m,deliver)=>{
    if(m.method!=='turn/start')return;
    deliver({id:m.id,result:{turn:{id:'t1'}}});
    deliver({method:'item/agentMessage/delta',params:{threadId:'other',itemId:'x',delta:'wrong'}});
    deliver({method:'item/started',params:{threadId:'a',item:{type:'agentMessage',id:'c',phase:'commentary',text:'thinking'}}});
    deliver({method:'item/agentMessage/delta',params:{threadId:'a',itemId:'m',delta:'partial'}});
    deliver({method:'item/completed',params:{threadId:'a',item:{type:'agentMessage',id:'m',phase:'final_answer',text:'final answer'}}});
    deliver({method:'turn/completed',params:{threadId:'a',turn:{id:'t1',status:'completed'}}});
  });
  await f.client.connect(); const result=await f.client.runTurn({threadId:'a',input:[]});
  assert.equal(result.text,'final answer'); assert.equal(result.status,'completed'); await f.client.close();
});

test('interrupted turn is distinct from completion', async () => {
  const f=fixture((m,d)=>{d({id:m.id,result:{turn:{id:'t2'}}});d({method:'turn/completed',params:{threadId:'a',turn:{id:'t2',status:'interrupted'}}});});
  await f.client.connect(); assert.equal((await f.client.runTurn({threadId:'a',input:[]})).status,'interrupted'); await f.client.close();
});

test('process exit rejects active turn and reconnects cleanly', async () => {
  const f=fixture((m,d)=>d({id:m.id,result:{turn:{id:'t3'}}}));
  await f.client.connect(); const promise=f.client.runTurn({threadId:'a',input:[]});
  f.callbacks.onExit(new Error('closed unexpectedly')); await assert.rejects(promise,/closed unexpectedly/);
  await f.client.connect(); assert.equal(f.launches,2); await f.client.close();
});

test('permission approval is declined with schema-correct object', async () => {
  const f=fixture(); await f.client.connect();
  f.deliver({id:99,method:'item/permissions/requestApproval',params:{}});
  await new Promise(r=>setImmediate(r));
  assert.deepEqual(f.writes.find(m=>m.id===99).result,{permissions:{},scope:'turn'}); await f.client.close();
});

test('early stop waits for turn id and tolerates server activation race', async () => {
  let accept, attempts = 0;
  const f=fixture((m,d)=>{
    if(m.method==='turn/start') accept=()=>d({id:m.id,result:{turn:{id:'late'}}});
    if(m.method==='turn/interrupt') {
      if (++attempts === 1) d({id:m.id,error:{code:-32600,message:'no active turn to interrupt'}});
      else { d({id:m.id,result:{}}); d({method:'turn/completed',params:{threadId:'a',turn:{id:'late',status:'interrupted'}}}); }
    }
  });
  await f.client.connect(); const pending=f.client.runTurn({threadId:'a',input:[]});
  await f.client.interrupt('a'); accept();
  assert.equal((await pending).status,'interrupted'); assert.equal(attempts,2); await f.client.close();
});

test('large image event is retained and stays below the image transport limit', async () => {
  const data='A'.repeat(17*1024*1024);
  const f=fixture((m,d)=>{if(m.method!=='turn/start')return;d({id:m.id,result:{turn:{id:'image-turn'}}});d({method:'item/completed',params:{threadId:'images',item:{id:'image-1',type:'imageGeneration',status:'completed',result:data}}});d({method:'turn/completed',params:{threadId:'images',turn:{id:'image-turn',status:'completed'}}});});
  await f.client.connect();const result=await f.client.runTurn({threadId:'images',input:[]});assert.equal(result.items[0].result.length,data.length);assert.equal(f.client.ready,true);await f.client.close();
});

test('native compaction waits for its turn events and preserves item results', async () => {
  const f=fixture((m,d)=>{if(m.method!=='thread/compact/start')return;d({id:m.id,result:{}});d({method:'turn/started',params:{threadId:'c',turn:{id:'compact'}}});d({method:'item/completed',params:{threadId:'c',turnId:'compact',item:{id:'compact-1',type:'contextCompaction'}}});d({method:'turn/completed',params:{threadId:'c',turn:{id:'compact',status:'completed'}}});});
  await f.client.connect();const result=await f.client.runTurn({threadId:'c'},{startMethod:'thread/compact/start'});assert.equal(result.status,'completed');assert.equal(result.items[0].type,'contextCompaction');await f.client.close();
});

test('RPC context error metadata remains available to the client', async () => {
  const f=fixture((m,d)=>d({id:m.id,error:{code:-1,message:'request failed',data:{codexErrorInfo:'contextWindowExceeded'}}}));await f.client.connect();await assert.rejects(f.client.request('bad'),e=>e.codexErrorInfo==='contextWindowExceeded');await f.client.close();
});

test('local timeout preserves already received text and image items', async () => {
  const f=fixture((m,d)=>{if(m.method==='turn/start'){d({id:m.id,result:{turn:{id:'slow'}}});d({method:'item/completed',params:{threadId:'slow',item:{id:'saved',type:'imageGeneration',status:'completed',result:'AA=='}}});d({method:'item/agentMessage/delta',params:{threadId:'slow',itemId:'answer',delta:'partial'}});}else if(m.method==='turn/interrupt')d({id:m.id,result:{}});});await f.client.connect();await assert.rejects(f.client.runTurn({threadId:'slow',input:[]},{timeout:20}),e=>e.code==='localTimeout'&&e.partialText==='partial'&&e.partialItems[0].id==='saved');await f.client.close();
});
