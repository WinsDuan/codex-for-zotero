// Runs with macOS /usr/bin/osascript -l JavaScript. No Finder automation,
// shell interpolation, admin access, or third-party runtime is required.
ObjC.import('Foundation');
function run() {
  try {
    var input=$.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
    if(Number(input.length)>24000)throw new Error('Request is too large');
    var request=JSON.parse(ObjC.unwrap($.NSString.alloc.initWithDataEncoding(input,$.NSUTF8StringEncoding)));
    return JSON.stringify(perform(request));
  } catch(e) { return JSON.stringify({ok:false,error:String(e.message||e)}); }
}
function perform(request) {
  var fm=$.NSFileManager.defaultManager;
  function normalized(value) {
    if(typeof value!=='string'||value.charAt(0)!=='/'||/[\r\n\0]/.test(value))throw new Error('Invalid absolute path');
    if(value.split('/').some(function(part){return part==='.'||part==='..';}))throw new Error('Relative path components are excluded');
    // NSString standardization can rewrite /private/var to the /var symlink.
    // Keep the actual caller path so symlink checks inspect the correct object.
    return '/'+value.split('/').filter(function(part){return part!=='';}).join('/');
  }
  function fail(error,message) {throw new Error(error[0]?ObjC.unwrap(error[0].localizedDescription):message);}
  function attributes(path) {
    var error=Ref(),value=fm.attributesOfItemAtPathError($(path),error);
    if(!value)fail(error,'Cannot inspect file');return value;
  }
  function fileType(path) {return ObjC.unwrap(attributes(path).objectForKey($.NSFileType));}
  function noLinks(path) {
    for(var cursor=path;;cursor=ObjC.unwrap($(cursor).stringByDeletingLastPathComponent)){
      if(fileType(cursor)==='NSFileTypeSymbolicLink')throw new Error('Symbolic links are excluded: '+cursor);
      if(cursor==='/')break;
    }
  }
  function regular(path) {if(fileType(path)!=='NSFileTypeRegular')throw new Error('Only regular files are allowed');noLinks(path);}
  var path=normalized(request.path),root=normalized(request.root);
  if(request.action==='recycle'||request.action==='permanent'){
    if(root==='/'||path.indexOf(root.replace(/\/$/,'')+'/')!==0)throw new Error('File is outside the conversation folder');
    regular(path);
    var fileURL=$.NSURL.fileURLWithPath($(path)),error=Ref();
    if(request.action==='permanent'){
      if(!fm.removeItemAtURLError(fileURL,error))fail(error,'Cannot delete file');return{ok:true};
    }
    var result=Ref();
    if(!fm.trashItemAtURLResultingItemURLError(fileURL,result,error))fail(error,'Cannot move file to Trash; no permanent fallback is used');
    if(!result[0])throw new Error('macOS did not return a restorable Trash URL');
    return{ok:true,recycledPath:ObjC.unwrap(result[0].path)};
  }
  if(request.action==='restore'){
    var destination=normalized(request.destination);
    if(root==='/'||destination.indexOf(root.replace(/\/$/,'')+'/')!==0)throw new Error('Restore destination is outside the conversation folder');
    // The caller also checks the persisted cleanup journal. Accept only native
    // Trash locations; never use restore as an arbitrary filesystem move.
    if(!/\/(?:\.Trash|\.Trashes\/[0-9]+)\//.test(path))throw new Error('Restore source is not in macOS Trash');
    regular(path);var parent=ObjC.unwrap($(destination).stringByDeletingLastPathComponent);noLinks(parent);
    if(fileType(parent)!=='NSFileTypeDirectory')throw new Error('Restore parent is not a directory');
    if(fm.fileExistsAtPath($(destination)))throw new Error('Destination exists; it was not overwritten');
    var moveError=Ref();
    if(!fm.moveItemAtURLToURLError($.NSURL.fileURLWithPath($(path)),$.NSURL.fileURLWithPath($(destination)),moveError))fail(moveError,'Cannot restore file');
    return{ok:true};
  }
  throw new Error('Unsupported file operation');
}
