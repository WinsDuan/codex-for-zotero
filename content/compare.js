window.addEventListener('load',()=>{
  'use strict';
  const {controller,itemID,chatID,documentID}=window.arguments[0],NS='http://www.w3.org/1999/xhtml';
  const el=(tag,cls,text)=>{const n=document.createElementNS(NS,tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const root=document.getElementById('compare-app'),header=el('header','compare-header'),grid=el('main','compare-grid'),footer=el('footer','compare-footer'),error=el('div','compare-error');
  const act=fn=>()=>{error.textContent='';Promise.resolve().then(fn).catch(e=>{error.textContent=e.message;});};
  const button=(text,fn)=>{const b=el('button','',text);b.type='button';b.addEventListener('click',act(fn));return b;};
  function sourceSelect(index){
    const element=el('div','compare-picker'),toggle=el('button','compare-picker-toggle'),title=el('span','compare-picker-title'),arrow=el('span','compare-picker-arrow','▾'),list=el('div','compare-picker-list');
    let value='',choices=[];
    list.id='compare-source-list-'+index;list.hidden=true;list.setAttribute('role','listbox');toggle.type='button';toggle.setAttribute('aria-haspopup','listbox');toggle.setAttribute('aria-controls',list.id);toggle.setAttribute('aria-expanded','false');arrow.setAttribute('aria-hidden','true');
    const close=(focus=false)=>{list.hidden=true;toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus();};
    const update=()=>{const choice=choices.find(c=>c.value===value);title.textContent=choice?.textContent||'请选择第二份资料';toggle.title=title.textContent;for(const child of list.children){const selected=child.dataset.value===value;child.setAttribute('aria-selected',String(selected));child.tabIndex=selected?0:-1;}};
    const open=()=>{if(!choices.length)return;list.hidden=false;toggle.setAttribute('aria-expanded','true');(list.querySelector('[aria-selected="true"]')||list.firstElementChild)?.focus();};
    toggle.addEventListener('click',()=>list.hidden?open():close());toggle.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open();}else if(event.key==='Escape')close();});
    list.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}const children=[...list.children],current=children.indexOf(document.activeElement);let next=current;if(event.key==='ArrowDown')next=Math.min(children.length-1,current+1);else if(event.key==='ArrowUp')next=Math.max(0,current-1);else if(event.key==='Home')next=0;else if(event.key==='End')next=children.length-1;else return;event.preventDefault();children[next]?.focus();});
    document.addEventListener('click',event=>{if(!element.contains(event.target))close();});element.addEventListener('focusout',event=>{if(!element.contains(event.relatedTarget))close();});
    toggle.append(title,arrow);element.append(toggle,list);
    return{element,get value(){return value;},set value(next){value=next;update();},setAttribute(key,text){toggle.setAttribute(key,text);if(key==='aria-label')list.setAttribute(key,text);},addEventListener(...args){element.addEventListener(...args);},replaceChildren(){choices=[];value='';list.replaceChildren();close();update();},append(choice){choices.push({value:choice.value,textContent:choice.textContent});const option=button(choice.textContent,()=>{value=choice.value;update();close(true);element.dispatchEvent(new Event('change'));});option.className='compare-picker-option';option.dataset.value=choice.value;option.setAttribute('role','option');list.append(option);update();}};
  }
  let sources=[],loading=false;
  header.append(el('h1','','文献并排阅读'),el('p','compare-caption','左、右两栏独立选择资料并滚动。此处展示提取文字，不保留 PDF / Word 原版式；未提取的图片不参与文本对比。'));
  const actions=el('div','compare-actions');header.append(actions,error);root.append(header,grid,footer);
  const compose=prompt=>controller.composeComparison(itemID,chatID,prompt);
  const selectedNames=()=>panels.map((p,i)=>(i?'右侧：':'左侧：')+(sources.find(s=>s.id===p.select.value)?.name||'尚无材料')).join('\n');
  const selectedPrompt=base=>compose(base+'\n本次重点比较：\n'+selectedNames()+'\n如本对话还有其他附件，请优先对比上述两份。标明来源，区分原文证据和推断。');
  actions.append(button('研究问题与方法',()=>selectedPrompt('请用对照表比较两份材料的研究问题、关键假设和方法，并解释方法为什么不同。')),button('实验与结论',()=>selectedPrompt('请比较两份材料的数据、实验设置、结论和局限；未提供的内容写待核对。')),button('共同点与分歧',()=>selectedPrompt('请列出两份材料的共同点、真正分歧和不能直接比较的部分，逐项给出依据。')),button('刷新资料',()=>loadSources()));
  const panels=[];
  for(let i=0;i<2;i++){
    const column=el('section','compare-column'),toolbar=el('div','compare-toolbar'),label=el('div','compare-picker-label',i?'右侧资料':'左侧资料'),select=sourceSelect(i),searchRow=el('div','compare-search-row'),search=el('input'),info=el('div','compare-source-info'),body=el('div','compare-body');
    select.setAttribute('aria-label',i?'右侧资料':'左侧资料');label.append(select.element);search.placeholder='在此文献中查找';search.setAttribute('aria-label','在'+(i?'右':'左')+'侧文献中查找');
    const panel={select,search,info,body,hits:[],hit:-1};panels.push(panel);
    const highlight=()=>{const source=sources.find(s=>s.id===select.value);body.replaceChildren();panel.hits=[];panel.hit=-1;if(!source){body.append(el('p','compare-empty','当前只有主论文时，请回到对话，用“＋”或拖拽加入第二篇 PDF / 文档，再点“刷新资料”。'));return;}const text=source.text||'',query=search.value.trim();if(!query){body.textContent=text;return;}const lower=text.toLocaleLowerCase(),needle=query.toLocaleLowerCase();let start=0,index;while((index=lower.indexOf(needle,start))>=0&&panel.hits.length<500){body.append(document.createTextNode(text.slice(start,index)));const mark=el('mark','',text.slice(index,index+query.length));body.append(mark);panel.hits.push(mark);start=index+query.length;}body.append(document.createTextNode(text.slice(start)));};
    const show=()=>{const source=sources.find(s=>s.id===select.value);info.textContent=source?source.text.length.toLocaleString()+' 字 · '+(source.warning||'本地提取文本'):'尚未选择第二份资料';search.value='';highlight();body.scrollTop=0;};
    select.addEventListener('change',show);search.addEventListener('input',highlight);
    const next=()=>{if(!panel.hits.length){info.textContent=search.value?'没有匹配结果':'请输入查找文字';return;}panel.hit=(panel.hit+1)%panel.hits.length;panel.hits[panel.hit].scrollIntoView({behavior:'smooth',block:'center'});info.textContent='匹配 '+(panel.hit+1)+' / '+panel.hits.length+(panel.hits.length===500?'（最多标记 500 处）':'');};
    search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();next();}});
    searchRow.append(search,button('下一处',next),button('解释选段',()=>{const selection=window.getSelection(),text=selection?.toString().trim();if(!text||!body.contains(selection.anchorNode)||!body.contains(selection.focusNode))throw new Error('请先在本栏正文中选中一段文字。');const source=sources.find(s=>s.id===select.value);return compose('请解释以下来自“'+source.name+'”的文字，并结合另一份资料说明异同。\n<selected_excerpt>\n'+text.slice(0,12000)+'\n</selected_excerpt>\n'+selectedNames());}));
    toolbar.append(label,searchRow,info);column.append(toolbar,body);grid.append(column);panel.show=show;
  }
  async function loadSources(){
    if(loading)return;loading=true;error.textContent='';footer.textContent='正在本地读取资料，尚未向模型发送…';
    try{const previous=panels.map(p=>p.select.value);sources=await controller.comparisonSources(itemID,chatID);panels.forEach((p,i)=>{p.select.replaceChildren();for(const source of sources){const option=el('option','',source.name);option.value=source.id;p.select.append(option);}if(i&&!sources[1]){const option=el('option','','请选择第二份资料');option.value='';p.select.append(option);}p.select.value=sources.some(s=>s.id===previous[i])?previous[i]:i?(sources.find(s=>s.id===documentID)?.id||sources[1]?.id||''):sources[0]?.id||'';p.show();});footer.textContent=sources.length+' 份可读资料。点击比较按钮会在对话中准备问题，由你确认发送；实际发送受该对话上下文字数上限约束。';}
    catch(e){error.textContent=e.message;footer.textContent='读取未完成，请检查附件或回到对话重新添加。';}
    finally{loading=false;}
  }
  void loadSources();
},{once:true});
