(function(g){
  'use strict';
  const os=g.Services.appinfo?.OS||'WINNT',isMac=os==='Darwin',isWindows=os==='WINNT';
  // Preserve case on macOS, including case-sensitive APFS volumes.
  const key=path=>{const value=g.PathUtils.normalize(path).replace(/\\/g,'/').replace(/\/+$/,'');return isWindows?value.toLowerCase():value;};
  const inside=(path,root)=>key(path).startsWith(key(root)+'/');
  function macCandidates(home=''){
    const apps=['/Applications',...(home?[g.PathUtils.join(home,'Applications')]:[])];
    return [...apps.flatMap(root=>['Codex.app','ChatGPT.app'].flatMap(app=>[
      g.PathUtils.join(root,app,'Contents','Resources','codex'),
      g.PathUtils.join(root,app,'Contents','Resources','bin','codex')
    ])),'/opt/homebrew/bin/codex','/usr/local/bin/codex',...(home?[
      g.PathUtils.join(home,'.local','bin','codex'),g.PathUtils.join(home,'.npm-global','bin','codex')
    ]:[])];
  }
  function environment(env){if(!isMac)return env;return{...env,PATH:[...new Set([...(env.PATH||'').split(':').filter(Boolean),'/opt/homebrew/bin','/usr/local/bin','/usr/bin','/bin','/usr/sbin','/sbin'])].join(':')};}
  function recyclePlan(folder){
    if(isMac)return{files:['recycle-macos.js'],command:'/usr/bin/osascript',arguments:['-l','JavaScript',g.PathUtils.join(folder,'recycle-macos.js')]};
    if(isWindows)return{files:['recycle.ps1','Recycle.cs'],command:g.PathUtils.join(g.Services.dirsvc.get('WinD',g.Ci.nsIFile).path,'System32','WindowsPowerShell','v1.0','powershell.exe'),arguments:['-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',g.PathUtils.join(folder,'recycle.ps1')]};
    throw new Error('当前系统尚未适配可撤销文件清理');
  }
  g.CodexPlatform={os,isMac,isWindows,key,inside,macCandidates,environment,recyclePlan,shortcut:isMac?'⌘⌥C':'Ctrl+Alt+C',modifier:isMac?'⌘':'Ctrl',trashName:isMac?'废纸篓':'回收站'};
})(this);
