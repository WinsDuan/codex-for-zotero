(function(g){
  'use strict';
  const {Zotero,Cc,Ci,IOUtils}=g;
  const imageTypes=new Set(['png','jpg','jpeg','webp']);
  const textTypes=new Set(['txt','md','markdown','csv','tsv','json','tex']);
  const MAX_CHARS=400000,MAX_PAGES=200;
  const extension=name=>String(name).split('.').at(-1).toLowerCase();
  function kind(name){const ext=extension(name);if(imageTypes.has(ext))return'image';if(textTypes.has(ext))return'text';if(ext==='pdf'||ext==='docx')return ext;throw new Error('支持 PDF、DOCX、TXT、Markdown、CSV、TSV、JSON、TeX 和 PNG/JPEG/WebP；旧版 .doc 请先另存为 DOCX。');}
  function decode(bytes){
    const {TextDecoder}=Zotero.getMainWindow();
    if(bytes[0]===255&&bytes[1]===254)return new TextDecoder('utf-16le').decode(bytes);
    if(bytes[0]===254&&bytes[1]===255)return new TextDecoder('utf-16be').decode(bytes);
    try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
    catch{return new TextDecoder('gb18030').decode(bytes);}
  }
  async function extract(path,name){
    const type=kind(name);let text='',warning='',totalPages=0,extractedPages=0;
    if(type==='pdf'){
      // Zotero 10's worker accepts bytes without importing the file into the library.
      const worker=Zotero.PDFWorker;
      if(!worker?._enqueue||!worker?._query)throw new Error('此 Zotero 版本的 PDF 提取接口不可用，请使用 Zotero 10.0.x。');
      let result;
      try{result=await worker._enqueue(async()=>{const bytes=await IOUtils.read(path),buf=new Uint8Array(bytes).buffer;return worker._query('pdf.getFulltext',{buf,maxPages:MAX_PAGES},[buf]);});}
      catch{throw new Error(name+'：无法提取 PDF，请检查是否加密或损坏；加密文件请先另存为可读取的 PDF。');}
      text=String(result.text||'');totalPages=result.totalPages||0;extractedPages=result.extractedPages||0;
      if(totalPages>extractedPages)warning='只提取前 '+extractedPages+' / '+totalPages+' 页。';
      if(!text.trim())throw new Error(name+'：没有可提取的文字，可能是扫描件。请先 OCR，或上传相关页面图片。');
    }else if(type==='docx'){
      const zip=Cc['@mozilla.org/libjar/zip-reader;1'].createInstance(Ci.nsIZipReader);
      try{
        const file=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);file.initWithPath(path);zip.open(file);
        if(!zip.hasEntry('word/document.xml')||zip.getEntry('word/document.xml').realSize>20*1024*1024)throw new Error('Word 正文过大或格式不正确');
        const xml=Zotero.File.getContents(zip.getInputStream('word/document.xml'),'UTF-8',20*1024*1024);
        const doc=new (Zotero.getMainWindow().DOMParser)().parseFromString(xml,'application/xml');
        if(doc.getElementsByTagName('parsererror').length)throw new Error('Word XML 无法解析');
        const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
        text=[...doc.getElementsByTagNameNS(W,'p')].map(p=>[...p.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join('')).join('\n');
        warning='已提取 Word 正文文字；图片、批注及原始版式未发送，表格和公式可能丢失结构。';
      }catch(e){throw new Error(name+'：DOCX 提取失败（'+e.message+'）');}
      finally{try{zip.close();}catch{}}
    }else if(type==='text'){
      text=decode(await IOUtils.read(path));
      if(extension(name)==='tex')warning='TeX 作为文本材料读取，不编译或执行命令。';
    }else throw new Error('图片无需提取文字，请使用图片解读。');
    text=text.replace(/\u0000/g,'').replace(/\r\n?/g,'\n').trim();
    if(!text)throw new Error(name+'：没有可读取的正文');
    const truncated=text.length>MAX_CHARS;
    if(truncated)warning+=(warning?' ':'')+'提取文本超过 '+MAX_CHARS.toLocaleString()+' 字，已保留前部。';
    return{text:text.slice(0,MAX_CHARS),kind:type,chars:Math.min(text.length,MAX_CHARS),totalPages,extractedPages,truncated,warning};
  }
  function budget(sources,maxChars){
    const usable=sources.filter(s=>s.text?.trim());if(!usable.length)return{text:'',sources:[],chars:0};
    const headings=usable.map((s,i)=>'[来源 '+(i+1)+'] '+String(s.name).slice(0,180)+'\n'+(s.warning?'材料范围：'+String(s.warning).slice(0,500)+'\n':''));
    const per=Math.floor((maxChars-headings.reduce((n,h)=>n+h.length,0)-2*(usable.length-1))/usable.length);
    if(per<100)throw new Error('资料较多，当前上下文字数预算不足。请在设置中把“文献上下文字数上限”提高到至少 '+Math.max(2000,usable.length*1000)+' 字。');
    const records=usable.map((s,i)=>{const marker='\n[本来源已按上下文预算截断]';const truncated=s.text.length>per;const body=truncated?s.text.slice(0,per-marker.length)+marker:s.text;return{...s,label:'来源 '+(i+1),sentChars:body.length,contextTruncated:truncated,block:headings[i]+body};});
    const text=records.map(s=>s.block).join('\n\n');
    return{text,sources:records.map(({text,block,...s})=>s),chars:text.length};
  }
  g.CodexDocuments={kind,extension,extract,budget,MAX_CHARS,MAX_PAGES};
})(this);
