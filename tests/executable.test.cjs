const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path').win32;

const local='C:\\Users\\Reader\\AppData\\Local';
const bin=path.join(local,'OpenAI','Codex','bin');
const managed=version=>path.join(bin,version,'codex.exe');
function fixture({configured='',files=[],children=[],times={},search={},broken=[]}={}){
  const present=new Set(files),cleared=[],searches=[];
  const subprocess={pathSearch:async value=>{searches.push(value);return search[value]||null;},getEnvironment:()=>({LOCALAPPDATA:local})};
  const scope={PathUtils:path,Services:{prefs:{getStringPref:()=>configured,clearUserPref:key=>cleared.push(key)}},Zotero:{debug:()=>{}},
    ChromeUtils:{importESModule:name=>name.includes('Subprocess')?{Subprocess:subprocess}:{}},
    IOUtils:{exists:async p=>present.has(p),getChildren:async()=>children,stat:async p=>{if(broken.includes(p))throw new Error('removed during update');return{type:'regular',lastModified:times[p]||0};}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../content/main.js'),'utf8'),scope);
  return{controller:Object.create(scope.CodexController.prototype),cleared,searches};
}

test('a replaced desktop version recovers to newest available binary and removes stale pin',async()=>{
  const previous=managed('old'),current=managed('current'),older=managed('older');
  const f=fixture({configured:previous,files:[bin,current,older],children:[path.dirname(older),path.dirname(current)],times:{[older]:1,[current]:2}});
  assert.equal(await f.controller.executable(),current);
  assert.equal(f.cleared.length,1);
  assert.equal(f.controller.executableRecovery.from,previous);
  assert.equal(f.controller.executableRecovery.to,current);
});
test('a valid custom executable remains selected',async()=>{
  const custom='D:\\Custom Codex\\codex.exe',f=fixture({configured:custom,files:[custom]});
  assert.equal(await f.controller.executable(),custom);assert.equal(f.searches.length,0);assert.equal(f.cleared.length,0);
});
test('missing custom executable reports the exact path without switching providers',async()=>{
  const custom='D:\\Custom Codex\\codex.exe',f=fixture({configured:custom,search:{'codex.exe':managed('current')}});
  await assert.rejects(f.controller.executable(),error=>error.code==='CODEX_EXECUTABLE_NOT_FOUND'&&error.message.includes(custom));
  assert.deepEqual(f.searches,[custom]);assert.equal(f.cleared.length,0);
});
test('automatic PATH discovery does not pin a versioned executable',async()=>{
  const current=managed('current'),f=fixture({search:{'codex.exe':current}});
  assert.equal(await f.controller.executable(),current);assert.equal(f.cleared.length,0);
});
test('a desktop version disappearing during scan does not hide another usable version',async()=>{
  const gone=managed('gone'),current=managed('current');
  const f=fixture({files:[bin,gone,current],children:[path.dirname(gone),path.dirname(current)],broken:[gone]});
  assert.equal(await f.controller.executable(),current);
});
test('failed recovery retains the original setting and provides a useful error',async()=>{
  const f=fixture({configured:managed('missing')});
  await assert.rejects(f.controller.executable(),error=>error.code==='CODEX_EXECUTABLE_NOT_FOUND'&&/更新后/.test(error.message));
  assert.equal(f.cleared.length,0);
});
test('pasted surrounding quotes are accepted for an existing executable',async()=>{
  const current=managed('current'),f=fixture({configured:'"'+current+'"',files:[current]});
  assert.equal(await f.controller.executable(),current);
});
