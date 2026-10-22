const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),paths=require('node:path');
function fixture({os='Darwin',configured='',files=[],search={}}={}){
  const p=os==='WINNT'?paths.win32:paths.posix,present=new Set(files),cleared=[],calls=[];
  const subprocess={getEnvironment:()=>({HOME:'/Users/Researcher',PATH:'/usr/bin:/bin'}),pathSearch:async name=>search[name]||null};
  const scope={Services:{appinfo:{OS:os},prefs:{getStringPref:()=>configured,clearUserPref:k=>cleared.push(k)},dirsvc:{get:key=>({path:key==='Home'?'/Users/Researcher':'C:\\Windows'})}},PathUtils:p,Ci:{nsIFile:{}},Zotero:{debug(){}},ChromeUtils:{importESModule:name=>name.includes('Subprocess')?{Subprocess:subprocess}:{}},IOUtils:{exists:async path=>present.has(path),stat:async path=>({type:path.endsWith('.app')?'directory':'regular'}),getChildren:async()=>[]}};
  vm.createContext(scope);for(const name of ['platform.js','main.js','management.js','workspace.js'])vm.runInContext(fs.readFileSync(paths.join(__dirname,'../content',name),'utf8'),scope);
  return{scope,p,controller:Object.create(scope.CodexController.prototype),cleared,calls};
}
test('Mac finds the desktop Codex binary without GUI PATH',async()=>{
  const binary='/Applications/Codex.app/Contents/Resources/codex',f=fixture({files:[binary]});assert.equal(await f.controller.executable(),binary);
});
test('Mac supports user Applications, Homebrew and custom binary paths',async()=>{
  for(const binary of ['/Users/Researcher/Applications/Codex.app/Contents/Resources/codex','/opt/homebrew/bin/codex','/usr/local/bin/codex'])assert.equal(await fixture({files:[binary]}).controller.executable(),binary);
  const binary='/Volumes/Research Data/Tools/codex';assert.equal(await fixture({configured:binary,files:[binary]}).controller.executable(),binary);
});
test('Mac accepts a selected app bundle and expands tilde',async()=>{
  const binary='/Users/Researcher/Applications/Codex.app/Contents/Resources/codex';assert.equal(await fixture({configured:'~/Applications/Codex.app',files:[binary]}).controller.executable(),binary);
});
test('a missing managed Mac app can recover to another installation',async()=>{
  const previous='/Applications/Codex.app/Contents/Resources/codex',current='/Users/Researcher/Applications/Codex.app/Contents/Resources/codex';const f=fixture({configured:previous,files:[current]});assert.equal(await f.controller.executable(),current);assert.equal(f.cleared.length,1);
});
test('missing Mac custom paths report the configured path',async()=>{
  const f=fixture({configured:'/Volumes/Missing/codex',files:['/opt/homebrew/bin/codex']});await assert.rejects(f.controller.executable(),/Volumes\/Missing/);assert.equal(f.cleared.length,0);
});
test('Mac GUI environment includes native tools and both Homebrew locations',()=>{
  const p=fixture().scope.CodexPlatform,env=p.environment({PATH:'/usr/bin:/bin',KEEP:'yes'});assert.equal(env.KEEP,'yes');for(const bin of ['/usr/bin','/opt/homebrew/bin','/usr/local/bin'])assert.ok(env.PATH.split(':').includes(bin));assert.equal(new Set(env.PATH.split(':')).size,env.PATH.split(':').length);
});
test('case-sensitive Mac workspaces do not merge or clean a sibling path',()=>{
  const p=fixture().scope.CodexPlatform;assert.notEqual(p.key('/Users/A/Paper/a.pdf'),p.key('/Users/A/paper/a.pdf'));assert.equal(p.inside('/Users/A/paper/a.pdf','/Users/A/Paper'),false);assert.equal(p.inside('/Users/A/Paper2/a.pdf','/Users/A/Paper'),false);assert.equal(p.inside('/Users/A/Paper/a.pdf','/Users/A/Paper'),true);
  const w=fixture({os:'WINNT'}).scope.CodexPlatform;assert.equal(w.key('C:\\Paper\\A.pdf'),w.key('c:\\paper\\a.pdf'));
});
test('Mac workspace migration preserves external paths with different case',()=>{
  const w=fixture().scope.CodexWorkspace,chat={workspace:'/Users/A/Paper',files:[{path:'/Users/A/Paper/artifacts/a.svg'},{path:'/Users/A/paper/external.pdf'}]};w.relocate(chat,'/Users/A/New');assert.equal(chat.files[0].path,'/Users/A/New/artifacts/a.svg');assert.equal(chat.files[1].path,'/Users/A/paper/external.pdf');
});
test('platform cleanup uses macOS Foundation instead of Windows tools',()=>{
  const p=fixture().scope.CodexPlatform,plan=p.recyclePlan('/Users/A/My Work/runtime');assert.equal(plan.command,'/usr/bin/osascript');assert.equal(plan.files.join(','),'recycle-macos.js');assert.equal(plan.arguments[2],'/Users/A/My Work/runtime/recycle-macos.js');assert.equal(p.shortcut,'⌘⌥C');assert.equal(p.trashName,'废纸篓');
});
test('Mac application bundles cannot launch by clicking an output link',async()=>{
  const f=fixture(),m=f.scope.CodexManagement;f.scope.Cc={'@mozilla.org/file/local;1':{createInstance:()=>({initWithPath(){},launch(){throw Error('must not launch');}})}};
  // Management captures Cc at module load, so use a fresh scope with its native file stub.
  vm.runInContext('this.Cc=globalThis.Cc;',f.scope);vm.runInContext(fs.readFileSync(paths.join(__dirname,'../content/management.js'),'utf8'),f.scope);
  await assert.rejects(f.scope.CodexManagement.open({},'/Applications/Example.app',null,false,'/Users/A'),/可执行/);
});
