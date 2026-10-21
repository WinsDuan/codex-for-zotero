const test = require('node:test');
const assert = require('node:assert/strict');
const state = require('../content/state.js');
const graphs = require('../content/graphs.js');
const study = require('../content/study.js');

test('v1 conversations preserve messages and resume mode', () => {
  const result=state.migrate({version:1,sessions:{'1:KEY':{threadId:'original-thread',messages:[{role:'user',text:'preserve me'}],modelChoice:'selected-model'}}});
  const container=result.get('1:KEY'),chat=container.conversations[0];
  assert.equal(chat.threadId,'original-thread');assert.equal(chat.messages[0].text,'preserve me');assert.equal(chat.settings.historyMode,'continuous');assert.equal(container.activeId,chat.id);
});
test('v2 preserves multiple conversations and active id', () => {
  const result=state.migrate({version:2,sessions:{'1:KEY':{activeId:'b',conversations:[{id:'a',name:'First',messages:[]},{id:'b',name:'Second',archived:true,messages:[]}]}}});
  assert.equal(result.get('1:KEY').activeId,'b');assert.equal(result.get('1:KEY').conversations[1].archived,true);
});
test('history sends only complete selected rounds within character budget', () => {
  const messages=[];for(let i=0;i<8;i++)messages.push({role:'user',text:'Question '+i},{role:'assistant',text:'Answer '+i,status:'completed'});
  messages.push({role:'user',text:'Failed question'},{role:'assistant',text:'Partial',status:'failed'});
  const history=state.boundedHistory(messages,{historyRounds:2,historyChars:1000});
  assert.equal(history.rounds,2);assert.match(history.text,/Answer 7/);assert.doesNotMatch(history.text,/Question 5|Partial/);
  assert.ok(state.boundedHistory(messages,{historyRounds:10,historyChars:25}).chars<=25);
  for(const budget of [1,5,17])assert.ok(state.boundedHistory(messages,{historyRounds:10,historyChars:budget}).chars<=budget);
  assert.equal(state.boundedHistory(messages,{historyRounds:0}).text,'');
});
test('graphs reject dangling edges and preserve safe text in SVG', () => {
  const graph={kind:'diagram',title:'Test <script>',nodes:[{id:'a',label:'<script>bad()</script>',detail:''},{id:'b',label:'Output',detail:''}],edges:[{from:'a',to:'b',label:''}],notes:''};
  const result=graphs.render(graph);assert.ok(result.width>0);assert.ok(!result.svg.includes('<script>'));assert.match(result.svg,/&lt;script&gt;/);
  assert.throws(()=>graphs.normalize({...graph,edges:[{from:'a',to:'missing'}]}),/无效/);
});
test('formula evaluator recalculates without executing code', () => {
  assert.equal(study.evaluate('e1 e1 * e2 e2 * + 2 /',{e1:2,e2:-2}),4);
  assert.equal(study.evaluate('e1 e1 * e2 e2 * + 2 /',{e1:4,e2:-2}),10);
  assert.throws(()=>study.evaluate('globalThis.process.exit()',{}),/不支持/);
  assert.throws(()=>study.evaluate('1 0 /',{}),/范围/);
});
