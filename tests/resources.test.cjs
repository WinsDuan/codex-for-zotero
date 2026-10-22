const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function setup(){
  const channels=[],reads=[],writes=new Map();
  const root='jar:file:///C:/Zotero/extensions/addon.xpi!/';
  const context={ChromeUtils:{importESModule(uri){if(uri.includes('NetUtil'))return{NetUtil:{newChannel(options){const channel={...options,kind:'nsIChannel'};channels.push(channel);return channel;}}};return{};}},
    Zotero:{File:{async getContentsAsync(source,charset){
      // Reproduce Zotero 10's unsupported username getter for jar: URI reads.
      if(typeof source==='string')throw new Error('NS_ERROR_FAILURE [nsIURI.username]');
      assert.equal(source.kind,'nsIChannel');assert.equal(charset,'utf-8');reads.push(source.uri);return source.uri.endsWith('SKILL.md')?'# PDF reader\n原始 PDF 图文读取':'native helper';
    }}},IOUtils:{async makeDirectory(){},async exists(p){return writes.has(p);},async readUTF8(p){return writes.get(p);},async writeUTF8(p,s){writes.set(p,s);}},PathUtils:{join:(...p)=>p.join('/')}};
  vm.createContext(context);
  for(const name of ['resources.js','pdf-reader.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../content',name),'utf8'),context);
  return{context,root,channels,reads,writes};
}
test('installed XPI skill uses a privileged channel instead of deprecated URI reads',async()=>{
  const {context,root,channels,writes}=setup();
  const reader=new context.CodexPDF.Reader({rootURI:root});
  const result=await reader.skill({sources:'C:/workspace/sources'});
  assert.equal(result.type,'skill');assert.equal(result.name,'research-pdf-reader');
  assert.equal(writes.get(result.path),'# PDF reader\n原始 PDF 图文读取');
  assert.equal(channels[0].uri,root+'content/skills/research-pdf-reader/SKILL.md');
  assert.equal(channels[0].loadUsingSystemPrincipal,true);
});
test('bundled resource reader supports both native cleanup helpers',async()=>{
  const {context,root,reads}=setup();
  for(const name of ['recycle.ps1','Recycle.cs'])assert.equal(await context.CodexResources.readText(root,'native/'+name),'native helper');
  assert.equal(reads.length,2);
});
test('bundled resource paths cannot escape the package content root',async()=>{
  const {context,root,channels}=setup();
  for(const relative of ['../secret','/absolute','file:///secret','native\\secret','native/./secret','native/../secret','native/a?b','native/a#b'])await assert.rejects(context.CodexResources.readText(root,relative),/Invalid/);
  assert.equal(channels.length,0);
});
test('PDF skill cache repairs stale text and reuses the exact current content',async()=>{
  const {context,root,writes}=setup();const reader=new context.CodexPDF.Reader({rootURI:root}),storage={sources:'C:/workspace/sources'};
  const first=await reader.skill(storage);writes.set(first.path,'outdated');
  await reader.skill(storage);assert.equal(writes.get(first.path),'# PDF reader\n原始 PDF 图文读取');
  await reader.skill(storage);assert.equal(writes.size,1);
});
