(function(g){
  'use strict';
  // Bundled resources can have jar: URLs when installed as an XPI. Passing
  // those URLs to Zotero.File.getContentsAsync routes them through HTTP's
  // credential parser in Zotero 10, where nsIURI.username is unsupported.
  const {NetUtil}=g.ChromeUtils.importESModule('resource://gre/modules/NetUtil.sys.mjs');
  async function readText(root,relative){
    if(typeof relative!=='string'||!relative||relative.split('/').some(part=>!part||part==='.'||part==='..')||/[:\\?#\0]/.test(relative))throw new Error('Invalid bundled resource path');
    const channel=NetUtil.newChannel({uri:root+'content/'+relative,loadUsingSystemPrincipal:true});
    const text=await g.Zotero.File.getContentsAsync(channel,'utf-8');
    if(typeof text!=='string')throw new Error('Bundled resource did not return text');
    return text;
  }
  g.CodexResources={readText};
})(this);
