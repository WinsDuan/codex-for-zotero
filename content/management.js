(function(g){
  'use strict';
  const {IOUtils,PathUtils,Cc,Ci,Services,Zotero}=g;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const id=prefix=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  const key=p=>PathUtils.normalize(p).replace(/\\/g,'/').replace(/\/$/,'').toLowerCase();
  const inside=(p,root)=>key(p).startsWith(key(root)+'/');
  function temporary(file,workspace){if(file.temporary)return true;let value=String(file.path||'').replace(/\\/g,'/');const root=String(workspace||'').replace(/\\/g,'/').replace(/\/+$/,'')+'/';if(root.length>1&&value.toLowerCase().startsWith(root.toLowerCase()))value=value.slice(root.length);else if(/^[a-z]:\//i.test(value))return false;return /(^|\/)(?:tmp|temp|\.cache|__pycache__|pdf-cache)(?:\/|$)/i.test(value);}
  const fields=['messages','documents','files','settings','executionDir','threadId','lastThreadId','actualModel','modelChoice','backendMode','threadWorkspace','threadNeedsSeed','sentContextKey','sentContextThread','lastContext','lastUsage','contextWindow','contextUsage','lastTask','pendingFork','rebuildHistory','pdfToolsVersion','previousThreadId'];
  function initialize(chat){
    chat.versionId||=id('v');chat.versionName||='原始版本';chat.versions||=[];
    for(const s of [chat,...chat.versions])for(const m of s.messages||[]){m.id||=id('m');m.workspace||=s.executionDir||chat.workspace;}
    return chat;
  }
  function snapshot(chat){initialize(chat);const value={id:chat.versionId,name:chat.versionName,createdAt:Date.now()};for(const f of fields)if(chat[f]!==undefined)value[f]=clone(chat[f]);return value;}
  function load(chat,value){for(const f of fields)delete chat[f];for(const f of fields)if(value[f]!==undefined)chat[f]=clone(value[f]);chat.messages||=[];chat.documents||=[];chat.files||=[];chat.versionId=value.id;chat.versionName=value.name;chat.connectedEpoch=-1;}
  function switchVersion(chat,target){initialize(chat);const i=chat.versions.findIndex(v=>v.id===target);if(i<0)return;const current=snapshot(chat),chosen=chat.versions.splice(i,1)[0];chat.versions.push(current);load(chat,chosen);}
  function invalidate(chat){chat.threadId=null;chat.connectedEpoch=-1;chat.sentContextKey=null;chat.pendingFork=null;chat.threadNeedsSeed=true;chat.rebuildHistory=true;}
  function branch(chat,messageId,text){
    initialize(chat);const at=chat.messages.findIndex(m=>m.id===messageId&&m.role==='user');if(at<0)throw new Error('找不到原消息');
    const source=clone(chat.messages[at]);if(source.images?.length&&!source.imageRefs?.length)throw new Error('这条旧消息没有保存图片路径，请把图片重新添加后发送；原版本已保留。');
    const prefix=clone(chat.messages.slice(0,at));const previous=prefix.at(-1);
    const oldThread=chat.threadId,old=snapshot(chat);chat.versions.push(old);chat.versionId=id('v');chat.versionName='编辑版本 '+new Date().toLocaleString();
    chat.messages=prefix;chat.settings=g.CodexState.settings(source.requestSettings||chat.settings);chat.documents=clone(source.documentRefs||chat.documents||[]);chat.files=[];chat.executionDir=PathUtils.join(chat.workspace,'branches',chat.versionId);
    invalidate(chat);if(previous?.role==='assistant'&&previous.status==='completed'&&previous.nativeTurnId&&previous.nativeThreadId===oldThread)chat.pendingFork={threadId:oldThread,lastTurnId:previous.nativeTurnId};
    return {text,images:source.imageRefs||[],task:source.task||'chat',settings:source.requestSettings||chat.settings};
  }
  function history(messages){const text=messages.filter(m=>m.status!=='running').map(m=>(m.role==='user'?'用户':'助手')+'：'+m.text+(m.artifact?.graph?'\n图谱结构：'+JSON.stringify(m.artifact.graph):'')).join('\n\n');return{text,chars:text.length,rounds:messages.filter(m=>m.role==='user').length};}
  function refs(state,controller){
    const result=new Set();const add=p=>{if(p&&PathUtils.isAbsolute(p))result.add(key(p));};
    for(const d of state.documents||[])try{add(controller.documentPath(d));add(controller.documentPath(d,true));}catch{}
    add(state.lastContext?.pdfSkillPath);for(const s of state.lastContext?.sources||[])add(s.originalPath);for(const m of state.messages||[]){for(const r of m.pdfReads||[])add(r.path);for(const i of m.imageRefs||[])add(i.path);for(const d of m.documentRefs||[])try{add(controller.documentPath(d));add(controller.documentPath(d,true));}catch{}for(const f of [...(m.generatedImages||[]),...(m.files||[])])add(f.path);if(m.artifact)add(PathUtils.join(m.artifact.baseDir||controller.artifactDir,m.artifact.id+'.svg'));}
    for(const f of state.files||[])add(f.path);return result;
  }
  function otherReferences(controller,chat,path){const k=key(path);for(const s of controller.allSessions()){if(s!==chat&&refs(s,controller).has(k))return true;for(const v of s.versions||[])if(refs(v,controller).has(k))return true;}return false;}
  async function checkedFile(path,root,expected){
    if(!PathUtils.isAbsolute(path)||!inside(path,root))throw new Error('文件不在此对话的独立目录中');
    let cursor=path;while(true){const s=await IOUtils.stat(cursor,{followSymlinks:false});if(s.type==='symlink'||s.isSymlink)throw new Error('不能清理符号链接或联接目录');if(key(cursor)===key(root))break;const parent=PathUtils.parent(cursor);if(parent===cursor)throw new Error('文件路径无效');cursor=parent;}
    const stat=await IOUtils.stat(path,{followSymlinks:false});if(stat.type!=='regular')throw new Error('只允许清理普通文件');
    if(expected&&(stat.size!==expected.size||stat.lastModified!==expected.modified))throw new Error('文件在清单生成后已变化，请刷新清单');return stat;
  }
  function resolve(path,workspace){
    let value=String(path).trim().replace(/^['"`]|['"`]$/g,'');if(/^file:/i.test(value)){const uri=Services.io.newURI(value).QueryInterface(Ci.nsIFileURL);value=uri.file.path;}
    try{value=decodeURIComponent(value);}catch{}if(/[\r\n\0]/.test(value)||/^[a-z]+:/i.test(value)&&!/^([a-z]:[\\/]|file:)/i.test(value))throw new Error('不支持此文件路径');
    if(!PathUtils.isAbsolute(value)){if(!workspace)throw new Error('这条消息没有关联保存位置');value=PathUtils.join(workspace,...value.replace(/\\/g,'/').split('/'));}return PathUtils.normalize(value);
  }
  async function open(controller,path,view,reveal=false,workspace){const full=resolve(path,workspace);const stat=await IOUtils.stat(full);const file=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);file.initWithPath(full);if(reveal){file.reveal();return;}if(stat.type==='directory'){file.launch();return;}if(/\.(exe|com|bat|cmd|ps1|vbs|js|msi|lnk|scr|py|pyw|ahk|sh)$/i.test(full))throw new Error('可执行文件请使用“定位”后自行打开');return controller.openWorkspaceFile({path:full,name:PathUtils.filename(full)},view);}
  async function review(controller,chat){
    if(controller.operation||controller.importing||controller.managementBusy)throw new Error('请等待当前操作结束');initialize(chat);const files=new Map();
    const add=async(path,kind)=>{try{const stat=await checkedFile(path,chat.workspace);const k=key(path);if(files.has(k))return;const shared=otherReferences(controller,chat,path),activeSource=(chat.documents||[]).some(d=>{try{return key(controller.documentPath(d))===k;}catch{return false;}});files.set(k,{path,name:PathUtils.filename(path),size:stat.size,modified:stat.lastModified,kind,protected:shared||activeSource,reason:shared?'其他对话或保留版本仍引用':activeSource?'当前仍在使用的来源副本':''});}catch{/* Never include external originals or links. */}};
    for(const f of chat.files||[])await add(f.path,'产物');for(const m of chat.messages){for(const f of [...(m.generatedImages||[]),...(m.files||[])])await add(f.path,'产物');if(m.artifact)await add(PathUtils.join(m.artifact.baseDir||controller.artifactDir,m.artifact.id+'.svg'),'科研图');}
    // Only enumerate attachment caches in known conversation folders, never Zotero originals.
    for(const root of new Set([chat.workspace,chat.executionDir].filter(Boolean))){const p=g.CodexWorkspace.paths(root);for(const folder of[p.uploads,p.sources])try{for(const path of await IOUtils.getChildren(folder)){const k=key(path);await add(path,'缓存');const row=files.get(k);if(row&&refs(chat,controller).has(k)){row.protected=true;row.reason='当前对话仍引用的来源副本';}}}catch{}}
    for(const root of new Set([chat.workspace,chat.executionDir].filter(Boolean)))try{for(const path of await IOUtils.getChildren(PathUtils.join(g.CodexWorkspace.paths(root).sources,'originals'))){await add(path,'原文件副本');const row=files.get(key(path));if(row&&refs(chat,controller).has(key(path))){row.protected=true;row.reason='当前对话或阅读依据仍引用的原文件副本';}}}catch{}
    return [...files.values()];
  }
  async function nativeRecycle(controller,action,path,destination,root){
    const Subprocess=g.ChromeUtils.importESModule('resource://gre/modules/Subprocess.sys.mjs').Subprocess;
    const folder=PathUtils.join(controller.profileDir,'runtime-060');await IOUtils.makeDirectory(folder,{createAncestors:true,ignoreExisting:true});
    for(const name of['recycle.ps1','Recycle.cs']){const data=await g.CodexResources.readText(controller.rootURI,'native/'+name);await IOUtils.writeUTF8(PathUtils.join(folder,name),data);}
    const exe=PathUtils.join(Services.dirsvc.get('WinD',Ci.nsIFile).path,'System32','WindowsPowerShell','v1.0','powershell.exe');
    const process=await Subprocess.call({command:exe,arguments:['-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',PathUtils.join(folder,'recycle.ps1')],stderr:'pipe'});
    await process.stdin.write(JSON.stringify({action,path,destination,root}));await process.stdin.close();
    const drain=async pipe=>{let text='',chunk;while((chunk=await pipe.readString()))text+=chunk;return text;};
    const [out,err,result]=await Promise.all([drain(process.stdout),drain(process.stderr),process.wait()]);
    let parsed;try{parsed=JSON.parse(out.trim());}catch{throw new Error('Windows 回收操作未返回有效结果：'+err.slice(0,200));}if(result.exitCode||!parsed.ok)throw new Error(parsed.error||err||'Windows 回收操作失败');return parsed;
  }
  function removeAsset(chat,path){const k=key(path);chat.files=(chat.files||[]).filter(f=>key(f.path)!==k);for(const m of chat.messages){m.files=(m.files||[]).filter(f=>key(f.path)!==k);m.generatedImages=(m.generatedImages||[]).filter(f=>key(f.path)!==k);if(m.artifact&&key(PathUtils.join(m.artifact.baseDir,m.artifact.id+'.svg'))===k){m.removedArtifactTitle=m.artifact.graph.title;delete m.artifact;}}}
  function journal(chat){chat.managementJournal||=[];return chat.managementJournal;}
  async function clean(controller,chat,{files=[],messageIds=[],permanent=false}){
    if(controller.operation||controller.importing||controller.managementBusy)throw new Error('请先等待或停止当前操作');controller.managementBusy=true;
    const entry={id:id('cleanup'),at:Date.now(),afterVersionId:chat.versionId,before:snapshot(chat),recycled:[],permanent,errors:[]};let bytes=0;
    try{for(const f of files){try{await checkedFile(f.path,chat.workspace,f);if(otherReferences(controller,chat,f.path))throw new Error('保留版本或其他对话仍引用此文件');if(refs({...chat,files:[],messages:chat.messages.map(m=>({...m,files:[],generatedImages:[],artifact:undefined}))},controller).has(key(f.path)))throw new Error('当前仍在使用的来源文件');
          if(permanent)await nativeRecycle(controller,'permanent',f.path,undefined,chat.workspace);else{const r=await nativeRecycle(controller,'recycle',f.path,undefined,chat.workspace);entry.recycled.push({path:f.path,recycledPath:r.recycledPath});}
          bytes+=f.size;removeAsset(chat,f.path);entry.changed=true;await controller.persist();
        }catch(e){entry.errors.push(f.name+'：'+e.message);}}
      if(messageIds.length){chat.messages=chat.messages.filter(m=>!messageIds.includes(m.id));invalidate(chat);entry.changed=true;}
      if(entry.changed){chat.updatedAt=Date.now();if(permanent){chat.managementJournal=[];delete entry.before;}else journal(chat).push(entry);}
      await controller.persist();return {bytes:permanent?bytes:0,recycledBytes:permanent?0:bytes,errors:entry.errors};
    }finally{controller.managementBusy=false;controller.refreshViews();}
  }
  async function undo(controller,chat){
    if(controller.operation||controller.importing||controller.managementBusy)throw new Error('请等待当前操作结束');const entry=journal(chat).at(-1);if(!entry)throw new Error('没有可撤销的清理');if(entry.afterVersionId&&entry.afterVersionId!==chat.versionId)throw new Error('请切回执行清理时的版本');controller.managementBusy=true;
    try{for(const file of entry.recycled){if(file.restored)continue;if(await IOUtils.exists(file.path))throw new Error('原路径已被占用，未覆盖：'+file.path);if(!inside(file.path,chat.workspace))throw new Error('恢复路径已失效');await checkedParent(file.path,chat.workspace);await nativeRecycle(controller,'restore',file.recycledPath,file.path);file.restored=true;await controller.persist();}
      // Undo is offered only until the next content mutation; it cannot discard a later answer.
      load(chat,entry.before);invalidate(chat);journal(chat).pop();await controller.persist();
    }finally{controller.managementBusy=false;controller.refreshViews();}
  }
  async function checkedParent(path,root){let p=PathUtils.parent(path);while(true){const s=await IOUtils.stat(p,{followSymlinks:false});if(s.type!=='directory')throw new Error('恢复目标目录无效');if(key(p)===key(root))return;p=PathUtils.parent(p);if(!inside(p,root)&&key(p)!==key(root))throw new Error('恢复目标越界');}}
  function expireUndo(chat){chat.managementJournal=[];}
  g.CodexManagement={clone,id,key,inside,temporary,initialize,snapshot,switchVersion,branch,history,invalidate,resolve,open,review,clean,undo,expireUndo,refs};
})(this);
