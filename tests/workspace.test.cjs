const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path').win32;
function fixture(initial={}){
  const files=new Map(Object.entries(initial)),writes=[],dirs=[];
  const scope={PathUtils:path,IOUtils:{makeDirectory:async p=>dirs.push(p),readUTF8:async p=>{if(!files.has(p))throw new Error('not found');return files.get(p);},writeUTF8:async(p,value,options)=>{files.set(p,value);writes.push({p,options});}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../content/workspace.js'),'utf8'),scope);
  return {workspace:scope.CodexWorkspace,files,writes,dirs};
}
test('workspace requires an absolute folder and has independent artifact locations',async()=>{
  const f=fixture();assert.throws(()=>f.workspace.paths('relative'),/保存位置/);const p=await f.workspace.prepare('D:\\reading\\chat-a');assert.equal(p.artifacts,'D:\\reading\\chat-a\\artifacts');assert.equal(f.dirs.length,4);
});
test('canonical conversation stays in its workspace; profile keeps a locator only',async()=>{
  const f=fixture(),chat={id:'a',name:'Paper A',workspace:'D:\\reading\\chat-a',messages:[{role:'user',text:'kept in chosen folder'}],settings:{}},legacy={id:'b',messages:[{role:'user',text:'legacy kept'}]};
  await f.workspace.save({sessions:new Map([['1:A',{title:'A',activeId:'a',conversations:[chat,legacy]}]]),statePath:'D:\\profile\\index.json',customPrompts:[]});
  const index=JSON.parse(f.files.get('D:\\profile\\index.json')),canonical=JSON.parse(f.files.get('D:\\reading\\chat-a\\conversation.json'));
  assert.equal(index.version,3);assert.equal(index.sessions['1:A'].conversations[0].external,true);assert.equal(index.sessions['1:A'].conversations[0].messages,undefined);assert.equal(canonical.messages[0].text,'kept in chosen folder');assert.equal(index.sessions['1:A'].conversations[1].messages[0].text,'legacy kept');assert.ok(f.writes.every(w=>w.options.tmpPath===w.p+'.tmp'));
});
test('moving a workspace rebases only descendants and preserves conversation id',async()=>{
  const moved='E:\\moved\\chat-a',original='D:/reading/chat-a',canonical={id:'a',workspace:original,documents:[{storageDir:original+'/attachments'}],messages:[{artifact:{baseDir:original+'/artifacts'},generatedImages:[{path:original+'/artifacts/figure.png'}]}],files:[{path:'D:/reading/chat-ab/other.txt'}]};
  const f=fixture({[path.join(moved,'conversation.json')]:JSON.stringify(canonical)}),saved={sessions:{'1:A':{conversations:[{id:'a',external:true,workspace:moved}]}}};await f.workspace.hydrate(saved);const chat=saved.sessions['1:A'].conversations[0];assert.equal(chat.id,'a');assert.equal(chat.documents[0].storageDir,path.join(moved,'attachments'));assert.equal(chat.messages[0].generatedImages[0].path,path.join(moved,'artifacts','figure.png'));assert.equal(chat.files[0].path,'D:/reading/chat-ab/other.txt');assert.equal(chat.sentContextKey,null);
});
test('a missing workspace remains recoverable and is never replaced by an empty canonical file',async()=>{
  const f=fixture(),stub={id:'a',external:true,workspace:'D:\\offline\\chat-a'},saved={sessions:{'1:A':{conversations:[stub]}}};await f.workspace.hydrate(saved);const chat=saved.sessions['1:A'].conversations[0];assert.match(chat.storageError,/无法读取工作区/);await f.workspace.save({sessions:new Map(Object.entries(saved.sessions)),statePath:'D:\\profile\\index.json',customPrompts:[]});assert.equal(f.files.has(path.join(stub.workspace,'conversation.json')),false);assert.equal(JSON.parse(f.files.get('D:\\profile\\index.json')).sessions['1:A'].conversations[0].workspace,stub.workspace);
});
