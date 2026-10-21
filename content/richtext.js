(function(g){
  'use strict';
  const NS='http://www.w3.org/1999/xhtml';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const engine=new g.marked.Marked({gfm:true,breaks:false,async:false,renderer:{html(token){return esc(token.text);},image(token){return esc(token.text||'[图片链接]');}},extensions:[
    {name:'czCjkStrong',level:'inline',start(src){return src.indexOf('**')<0?undefined:src.indexOf('**');},tokenizer(src){const match=src.match(/^\*\*([^\s*][^*\n]{0,1999}?)\*\*(?=[\p{L}\p{N}])/u);if(match&&/\p{Script=Han}/u.test(match[1])&&/\p{P}$/u.test(match[1]))return{type:'czCjkStrong',raw:match[0],tokens:this.lexer.inlineTokens(match[1])};},renderer(t){return'<strong>'+this.parser.parseInline(t.tokens)+'</strong>';}},
    {name:'czDisplayMath',level:'block',start(src){return src.search(/(?:\$\$|\\\[)/);},tokenizer(src){const match=src.match(/^(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\])(?:\n|$)/);if(match)return{type:'czDisplayMath',raw:match[0],text:(match[1]||match[2]).trim()};},renderer(t){return'<span class="cz-math-slot" data-display="block">'+esc(t.text)+'</span>'; }},
    {name:'czInlineMath',level:'inline',start(src){const at=src.search(/(?:\$(?!\$)|\\\()/);return at<0?undefined:at;},tokenizer(src){const match=src.match(/^(?:\$([^$\n]+?)\$(?!\$)|\\\(([^\n]+?)\\\))/);if(match)return{type:'czInlineMath',raw:match[0],text:match[1]||match[2]};},renderer(t){return'<span class="cz-math-slot" data-display="inline">'+esc(t.text)+'</span>'; }},
  ]});
  const allowed=new Set('p strong em del code pre blockquote ul ol li h1 h2 h3 h4 h5 h6 table thead tbody tr th td hr br a span input'.split(' '));
  function formula(doc,parent,text,display){
    const wrapper=doc.createElementNS(NS,display?'div':'span');wrapper.className=display?'cz-math-block':'cz-math-inline';
    try{if(text.length>16000)throw new Error('Formula too long');const html=g.katex.renderToString(text,{output:'mathml',displayMode:display,trust:false,throwOnError:false,maxExpand:1000,maxSize:20,strict:'ignore'});const parsed=new doc.defaultView.DOMParser().parseFromString(html,'text/html');const node=parsed.querySelector('math');if(!node)throw new Error('Invalid formula');wrapper.append(doc.importNode(node,true));}catch{const code=doc.createElementNS(NS,'code');code.textContent=text;wrapper.append(code);}
    if(display){const copy=doc.createElementNS(NS,'button');copy.type='button';copy.className='cz-formula-copy';copy.textContent='复制 LaTeX';copy.addEventListener('click',()=>g.CodexForZotero.copyText(text));wrapper.append(copy);}
    parent.append(wrapper);
  }
  function render(doc,parent,text){
    let html;try{html=engine.parse(String(text));}catch{const pre=doc.createElementNS(NS,'pre');pre.textContent=String(text);parent.append(pre);return;}
    const parsed=new doc.defaultView.DOMParser().parseFromString(html,'text/html');
    function copy(source,target){
      if(source.nodeType===3){target.append(doc.createTextNode(source.textContent));return;}
      if(source.nodeType!==1)return;const tag=source.localName.toLowerCase();
      if(tag==='span'&&source.classList.contains('cz-math-slot')){formula(doc,target,source.textContent,source.dataset.display==='block');return;}
      if(!allowed.has(tag)){for(const child of source.childNodes)copy(child,target);return;}
      const node=doc.createElementNS(NS,tag);if(['th','td'].includes(tag)&&['left','center','right'].includes(source.getAttribute('align')))node.style.textAlign=source.getAttribute('align');
      if(tag==='a'){const href=source.getAttribute('href')||'';if(/^https?:\/\//i.test(href)){node.href=href;node.addEventListener('click',event=>{event.preventDefault();g.Zotero.launchURL(href);});}else if(href&&!/^(?:javascript|data|vbscript):/i.test(href)){node.dataset.localPath=href;node.setAttribute('role','link');}}
      if(tag==='input'){if(source.getAttribute('type')!=='checkbox')return;node.type='checkbox';node.checked=source.hasAttribute('checked');node.disabled=true;}
      if(tag==='code'&&/^language-[\w-]+$/.test(source.className))node.className=source.className;
      if(tag==='pre')node.className='cz-code';
      if(tag==='table'){
        const wrap=doc.createElementNS(NS,'div');wrap.className='cz-table-wrap';const tools=doc.createElementNS(NS,'div');tools.className='cz-table-tools';const button=doc.createElementNS(NS,'button');button.type='button';button.textContent='复制表格';button.addEventListener('click',()=>{const rows=[...source.querySelectorAll('tr')].map(row=>[...row.children].map(cell=>cell.textContent.replace(/[\t\r\n]+/g,' ')).join('\t'));g.CodexForZotero.copyText(rows.join('\n'));});tools.append(button);wrap.append(tools,node);target.append(wrap);
      }else target.append(node);
      for(const child of source.childNodes)copy(child,node);
    }
    for(const node of parsed.body.childNodes)copy(node,parent);
  }
  g.CodexRichText={render,formula};
})(this);
