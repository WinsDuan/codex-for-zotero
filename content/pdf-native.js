(function(g){
  'use strict';
  const {Zotero,ChromeUtils,Cu}=g;
  const timers=ChromeUtils.importESModule('resource://gre/modules/Timer.sys.mjs');
  const unwrap=win=>win?Cu.waiveXrays(win):null;
  function readerWindow(){
    const active=Zotero.Reader.getByTabID(Zotero.getMainWindow()?.Zotero_Tabs?.selectedID);
    for(const reader of [active,...Zotero.Reader._readers].filter(Boolean)){
      const win=unwrap(reader._internalReader?._primaryView?._iframeWindow);
      if(win&&!win.closed&&win.pdfjsLib?.getDocument)return win;
    }return null;
  }
  class NativePDF {
    constructor(){this.browser=null;this.documents=new Map();this.window=null;}
    async initialize(){
      this.window=readerWindow();if(this.window)return this;
      const doc=Zotero.getMainWindow()?.document;if(!doc)throw new Error('请保持 Zotero 主窗口打开');
      // Load Zotero's own resource document in a native browser. Loading a module
      // from the add-on's jar URL in a bare HTML iframe is not reliable in XUL.
      const browser=doc.createXULElement('browser');browser.setAttribute('type','content');browser.setAttribute('remote','false');browser.setAttribute('disableglobalhistory','true');browser.style.cssText='position:fixed;left:-10000px;top:0;width:32px;height:32px;visibility:hidden;pointer-events:none';
      this.browser=browser;doc.documentElement.append(browser);
      browser.loadURI(g.Services.io.newURI('resource://zotero/reader/pdf/web/viewer.html?file='),{triggeringPrincipal:g.Services.scriptSecurityManager.getSystemPrincipal()});
      const started=Date.now();
      while(Date.now()-started<8000){
        const win=unwrap(browser.contentWindow);if(win?.pdfjsLib?.getDocument){this.window=win;return this;}
        if(!browser.isConnected)throw new Error('PDF 阅读视图已关闭');await new Promise(resolve=>timers.setTimeout(resolve,40));
      }
      await this.close();throw new Error('Zotero PDF.js 未就绪。请打开任意本地 PDF 后再提问；无需重复重启或安装 Poppler。');
    }
    has(id){return this.documents.has(id);}
    async open(id,bytes){
      if(this.has(id))return;if(!this.window||this.window.closed)throw new Error('PDF 阅读器窗口已关闭，请重新打开论文');
      if(this.documents.size>=2){const first=this.documents.keys().next().value;await this.documents.get(first).destroy();this.documents.delete(first);}
      // Clone bytes/options into the already initialized reader realm. Keep the
      // user's displayed PDF untouched: create a separate document from its snapshot.
      const options=Cu.cloneInto({data:bytes,isEvalSupported:false,enableXfa:false,
        cMapUrl:'resource://zotero/reader/pdf/web/cmaps/',cMapPacked:true,
        standardFontDataUrl:'resource://zotero/reader/pdf/web/standard_fonts/',
        wasmUrl:'resource://zotero/document-worker/wasm/',useWorkerFetch:false},this.window);
      const task=Cu.waiveXrays(this.window.pdfjsLib.getDocument(options));
      task.onPassword=Cu.exportFunction(()=>{void task.destroy();},this.window);
      this.documents.set(id,Cu.waiveXrays(await task.promise));
    }
    doc(id){const doc=this.documents.get(id);if(!doc)throw new Error('PDF 尚未打开');return doc;}
    async metadata(id){const doc=this.doc(id);const outline=(items,depth=0)=>depth>2?[]:Array.from(items||[]).slice(0,60).map(i=>({title:String(i.title||'').slice(0,180),children:outline(i.items,depth+1)}));return{pages:doc.numPages,labels:await doc.getPageLabels().catch(()=>null),outline:outline(await doc.getOutline().catch(()=>[]))};}
    async text(id,n){const doc=this.doc(id);if(!Number.isInteger(n)||n<1||n>doc.numPages)throw new Error('PDF 页码超出范围');const page=Cu.waiveXrays(await doc.getPage(n));try{const content=Cu.waiveXrays(await page.getTextContent());return Array.from(content.items).map(i=>i.str+(i.hasEOL?'\n':' ')).join('').replace(/\u0000/g,'').trim();}finally{page.cleanup();}}
    async image(id,n){
      const doc=this.doc(id);if(!Number.isInteger(n)||n<1||n>doc.numPages)throw new Error('PDF 页码超出范围');
      const page=Cu.waiveXrays(await doc.getPage(n)),base=Cu.waiveXrays(page.getViewport(Cu.cloneInto({scale:1},this.window))),viewport=Cu.waiveXrays(page.getViewport(Cu.cloneInto({scale:2048/Math.max(base.width,base.height)},this.window)));
      if(!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||viewport.width<1||viewport.height<1)throw new Error('PDF 页面尺寸未正确传入阅读器');
      const canvas=this.window.document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      try{const options=new this.window.Object();options.canvasContext=canvas.getContext('2d');options.viewport=viewport;options.background='rgb(255,255,255)';options.annotationMode=0;await page.render(options).promise;let imageUrl=canvas.toDataURL('image/png');if(imageUrl.length>6*1024*1024)imageUrl=canvas.toDataURL('image/jpeg',0.92);if(imageUrl.length>9*1024*1024)throw new Error('此页图像过大，请单独上传局部截图');return{imageUrl,width:canvas.width,height:canvas.height};}finally{canvas.width=canvas.height=1;page.cleanup();}
    }
    async close(){for(const doc of this.documents.values())await doc.destroy().catch(()=>{});this.documents.clear();this.browser?.remove();this.browser=null;this.window=null;}
  }
  g.CodexNativePDF={NativePDF};
})(this);
