const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const helper=path.resolve(__dirname,'../content/native/recycle-macos.js');
function call(request){const r=spawnSync('/usr/bin/osascript',['-l','JavaScript',helper],{input:JSON.stringify(request),encoding:'utf8',timeout:20000,env:{...process.env,RESEARCH_BRIDGE_NATIVE_DEBUG:'1'}});assert.equal(r.status,0,JSON.stringify({stderr:r.stderr,signal:r.signal,error:r.error?.message,action:request.action}));return JSON.parse(r.stdout);}
test('native macOS Trash round trip, boundaries, symlinks and no overwrite',{skip:process.platform!=='darwin'},()=>{
  const base=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'research-bridge-mac-')),root=path.join(base,'对话 With Spaces');fs.mkdirSync(root);fs.mkdirSync(path.join(os.homedir(),'.Trash'),{recursive:true});
  const file=path.join(root,'科研图 100%.txt'),external=path.join(base,'external.txt');fs.writeFileSync(file,'test generated artifact');fs.writeFileSync(external,'keep');
  const moved=call({action:'recycle',path:file,root});assert.equal(moved.ok,true,JSON.stringify(moved));assert.equal(fs.existsSync(file),false);assert.equal(fs.readFileSync(moved.recycledPath,'utf8'),'test generated artifact');
  fs.writeFileSync(file,'occupied');assert.equal(call({action:'restore',path:moved.recycledPath,destination:file,root}).ok,false);assert.equal(fs.readFileSync(file,'utf8'),'occupied');fs.unlinkSync(file);
  assert.equal(call({action:'restore',path:moved.recycledPath,destination:file,root}).ok,true);assert.equal(fs.readFileSync(file,'utf8'),'test generated artifact');
  assert.equal(call({action:'permanent',path:external,root}).ok,false);assert.equal(fs.readFileSync(external,'utf8'),'keep');
  const link=path.join(root,'linked.txt');fs.symlinkSync(external,link);assert.equal(call({action:'permanent',path:link,root}).ok,false);assert.equal(fs.existsSync(external),true);
  assert.equal(call({action:'permanent',path:file,root}).ok,true);assert.equal(fs.existsSync(file),false);
  // Only this freshly created test directory is removed, after restoring Trash.
  fs.rmSync(base,{recursive:true,force:true});
});
