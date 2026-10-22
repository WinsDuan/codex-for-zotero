ObjC.import('Foundation');
function run(argv) {
  var fm=$.NSFileManager.defaultManager,home=ObjC.unwrap($.NSHomeDirectory()),env=$.NSProcessInfo.processInfo.environment.mutableCopy;
  var path=ObjC.unwrap(env.objectForKey($('PATH')))||'';env.setObjectForKey($(path+':/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'),$('PATH'));
  function execute(command,args){
    try{
      var task=$.NSTask.alloc.init,stdout=$.NSPipe.pipe,stderr=$.NSPipe.pipe,error=$();task.executableURL=$.NSURL.fileURLWithPath($(command));task.arguments=$(args);task.environment=env;task.standardOutput=stdout;task.standardError=stderr;
      if(!task.launchAndReturnError(error))return{ok:false,error:ObjC.unwrap(error.localizedDescription)||'Cannot launch'};
      var started=Date.now();while(task.running&&Date.now()-started<12000)$.NSThread.sleepForTimeInterval(0.05);
      if(task.running){task.terminate;return{ok:false,error:'Command timed out'};}
      var out=ObjC.unwrap($.NSString.alloc.initWithDataEncoding(stdout.fileHandleForReading.readDataToEndOfFile,$.NSUTF8StringEncoding))||'';
      var err=ObjC.unwrap($.NSString.alloc.initWithDataEncoding(stderr.fileHandleForReading.readDataToEndOfFile,$.NSUTF8StringEncoding))||'';
      return{ok:task.terminationStatus===0,exitCode:Number(task.terminationStatus),text:(out||err).trim().slice(0,1200)};
    }catch(e){return{ok:false,error:String(e.message||e)};}
  }
  var candidates=[];if(argv[0])candidates.push(argv[0]);
  ['/Applications',home+'/Applications'].forEach(function(root){['Codex.app','ChatGPT.app'].forEach(function(app){candidates.push(root+'/'+app+'/Contents/Resources/codex',root+'/'+app+'/Contents/Resources/bin/codex');});});
  candidates.push('/opt/homebrew/bin/codex','/usr/local/bin/codex',home+'/.local/bin/codex',home+'/.npm-global/bin/codex');
  path.split(':').forEach(function(folder){if(folder)candidates.push(folder+'/codex');});
  var selected='';for(var i=0;i<candidates.length;i++)if(fm.isExecutableFileAtPath($(candidates[i]))){selected=candidates[i];break;}
  var zotero='';['/Applications/Zotero.app',home+'/Applications/Zotero.app'].forEach(function(app){if(!zotero&&fm.fileExistsAtPath($(app)))zotero=app;});
  var report={product:'Codex for Zotero · 研桥',version:'0.6.6',date:new Date().toISOString(),system:ObjC.unwrap($.NSProcessInfo.processInfo.operatingSystemVersionString),architecture:execute('/usr/bin/uname',['-m']).text,zoteroApp:zotero||null,codexExecutable:selected||null};
  if(zotero)report.zoteroVersion=ObjC.unwrap($.NSBundle.bundleWithPath($(zotero)).objectForInfoDictionaryKey($('CFBundleShortVersionString')));
  if(selected){report.codexVersion=execute(selected,['--version']);report.appServer=execute(selected,['app-server','--help']);var login=execute(selected,['login','status']);report.login={ok:login.ok,exitCode:login.exitCode,error:login.error||null};}
  report.status=selected&&report.codexVersion.ok&&report.appServer.ok&&report.login.ok&&zotero?'environment-ready':'needs-attention';
  report.scope='Environment only. This does not verify Zotero UI, PDF tool delivery, image generation, or successful model responses. No API key, auth file, paper, or chat was read.';
  return JSON.stringify(report,null,2);
}
