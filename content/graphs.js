(function (global) {
  'use strict';
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const schema = {
    type: 'object', additionalProperties: false, required: ['title','kind','nodes','edges','notes'],
    properties: {
      title: { type: 'string' }, kind: { type: 'string', enum: ['mindmap','diagram'] }, notes: { type: 'string' },
      nodes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id','label','detail'], properties: { id: { type: 'string' }, label: { type: 'string' }, detail: { type: 'string' } } } },
      edges: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['from','to','label'], properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' } } } },
    },
  };
  function parse(text, kind) {
    const raw = String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    let value; try { value = JSON.parse(raw); } catch { throw new Error('模型未返回有效图谱结构，请重新生成或补充更明确的要求。'); }
    return normalize({ ...value, kind: kind || value.kind });
  }
  function normalize(value) {
    if (!value || !['mindmap','diagram'].includes(value.kind) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) throw new Error('图谱需要 kind、nodes 和 edges 字段');
    if (!value.nodes.length || value.nodes.length > 32 || value.edges.length > 64) throw new Error('单张图需包含 1–32 个节点，最多 64 条连线；请拆成多张图。');
    const ids = new Set();
    const nodes = value.nodes.map(n => {
      const id = String(n.id || '').trim();
      if (!id || ids.has(id)) throw new Error('图谱节点 id 为空或重复'); ids.add(id);
      const label = String(n.label || '').trim(); const detail = String(n.detail || '').trim();
      if (!label || label.length > 70 || detail.length > 160) throw new Error('节点标题最多 70 字，说明最多 160 字；请缩短文字或拆分节点。');
      return { id, label, detail };
    });
    const edges = value.edges.map(e => {
      if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) throw new Error('连线的起止节点无效');
      if (String(e.label || '').length > 32) throw new Error('连线说明最多 32 字');
      return { from: e.from, to: e.to, label: String(e.label || '') };
    });
    return { title: String(value.title || '文献图谱').slice(0,100), kind: value.kind, nodes, edges, notes: String(value.notes || '').slice(0,1000) };
  }
  function wrap(text, width = 22) {
    const lines = []; let line = '', units = 0;
    for (const char of String(text)) {
      const size = char.charCodeAt(0) > 255 ? 1 : .58;
      if (char === '\n' || units + size > width) { lines.push(line); line = ''; units = 0; if (char === '\n') continue; }
      line += char; units += size;
    }
    if (line) lines.push(line); return lines;
  }
  function render(source) {
    const graph = normalize(source); const nodes = graph.nodes.map(n => ({ ...n, titleLines: wrap(n.label, 17), detailLines: wrap(n.detail, 22) }));
    const byId = new Map(nodes.map(n => [n.id,n]));
    const incoming = new Set(graph.edges.map(e => e.to));
    const roots = nodes.filter(n => !incoming.has(n.id));
    const queue = (roots.length ? roots : [nodes[0]]).map(n => [n.id, 0]);
    const ranks = new Map();
    while (queue.length) {
      const [id, rank] = queue.shift(); if (ranks.has(id)) continue; ranks.set(id, rank);
      for (const edge of graph.edges) if (edge.from === id && !ranks.has(edge.to)) queue.push([edge.to,rank+1]);
    }
    for (const n of nodes) if (!ranks.has(n.id)) ranks.set(n.id, 0);
    const columns = new Map();
    for (const n of nodes) { const rank = ranks.get(n.id); if (!columns.has(rank)) columns.set(rank,[]); columns.get(rank).push(n); n.h = 34 + n.titleLines.length*23 + n.detailLines.length*19; }
    const colHeight = col => col.reduce((total,n) => total+n.h+34,0);
    const contentHeight = Math.max(...[...columns.values()].map(colHeight));
    const width = Math.max(760, 116 + columns.size*370);
    const titleLines=wrap(graph.title,Math.floor((width-116)/23));
    const noteLines=graph.notes?wrap(graph.notes,Math.floor((width-116)/12)):[];
    const headerHeight=105+Math.max(0,titleLines.length-1)*29;
    const height=contentHeight+headerHeight+55+noteLines.length*18;
    for (const [rank,col] of columns) {
      let y = headerHeight + (contentHeight-colHeight(col))/2;
      for (const n of col) { n.x=58+rank*370; n.y=y; n.w=268; y+=n.h+34; }
    }
    const colors = ['#0f766e','#2563eb','#7c3aed','#b45309','#be185d'];
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(graph.title)}</title><desc>${esc(graph.notes)}</desc><metadata>${esc(JSON.stringify(graph))}</metadata><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8"/></marker></defs><rect width="100%" height="100%" fill="#ffffff"/><g font-family="Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif">`];
    titleLines.forEach((line,i)=>parts.push(`<text x="58" y="${46+i*29}" font-size="23" font-weight="700" fill="#14213d">${esc(line)}</text>`));
    parts.push(`<text x="58" y="${headerHeight-32}" font-size="12" fill="#64748b">${graph.kind === 'mindmap' ? '论文思维导图' : '科研示意图'} · 可编辑 SVG · 结论以原文证据为准</text>`);
    graph.edges.forEach((edge,i) => {
      const a=byId.get(edge.from), b=byId.get(edge.to); const forward=b.x>a.x;
      const x1=forward?a.x+a.w:a.x+a.w/2, y1=forward?a.y+a.h/2:a.y+a.h;
      const x2=forward?b.x:b.x+b.w/2, y2=forward?b.y+b.h/2:b.y;
      const d=forward?`M${x1} ${y1} C${x1+48} ${y1},${x2-48} ${y2},${x2} ${y2}`:`M${x1} ${y1} C${x1+25} ${y1+15},${x2+25} ${y2-15},${x2} ${y2}`;
      parts.push(`<path d="${d}" fill="none" stroke="#94a3b8" stroke-width="1.8" ${graph.kind==='diagram'?'marker-end="url(#arrow)"':''}/>`);
      if(edge.label){const labelLines=wrap(edge.label,8), x=(x1+x2)/2, y=(y1+y2)/2;parts.push(`<rect x="${x-55}" y="${y-12}" width="110" height="${labelLines.length*16+8}" rx="4" fill="white"/>`);labelLines.forEach((line,j)=>parts.push(`<text x="${x}" y="${y+j*16+2}" text-anchor="middle" font-size="11" fill="#526076">${esc(line)}</text>`));}
    });
    for(const n of nodes){const color=colors[ranks.get(n.id)%colors.length];parts.push(`<g data-node-id="${esc(n.id)}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="10" fill="#f8fafc" stroke="#dce3ec"/><rect x="${n.x}" y="${n.y+13}" width="4" height="${n.h-26}" rx="2" fill="${color}"/>`);n.titleLines.forEach((line,i)=>parts.push(`<text x="${n.x+18}" y="${n.y+28+i*23}" font-size="16" font-weight="600" fill="${color}">${esc(line)}</text>`));n.detailLines.forEach((line,i)=>parts.push(`<text x="${n.x+18}" y="${n.y+34+n.titleLines.length*23+i*19}" font-size="12" fill="#475569">${esc(line)}</text>`));parts.push('</g>');}
    noteLines.forEach((line,i)=>parts.push(`<text x="58" y="${headerHeight+contentHeight+18+i*18}" font-size="11" fill="#64748b">${esc(line)}</text>`));
    parts.push('</g></svg>'); return { graph, svg: parts.join(''), width, height };
  }
  global.CodexGraphs = { schema, parse, normalize, render };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.CodexGraphs;
})(this);
