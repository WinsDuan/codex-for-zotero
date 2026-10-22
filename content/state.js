(function (global) {
  'use strict';
  const defaults = { model: '', effort: '', historyMode: 'continuous', historyRounds: 12, historyChars: 24000, paperChars: 40000, answerLength: 'standard', fullText: false, autoReadPDF: true, multiPaper: false, toolMode: 'workspace', skillPath: '' };
  const uuid = () => 'chat-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  function settings(value = {}) {
    const out = { ...defaults, ...value };
    out.autoReadPDF=value.autoReadPDF!==false;
    const clamp = (key, min, max) => { out[key] = Math.max(min, Math.min(max, Number(out[key]) || 0)); };
    clamp('historyRounds', 0, 100); clamp('historyChars', 0, 500000); clamp('paperChars', 1000, 2000000);
    if(!['readonly','workspace'].includes(out.toolMode))out.toolMode='workspace';
    if (!['bounded','continuous'].includes(out.historyMode)) out.historyMode = 'bounded';
    if (!['short','standard','long'].includes(out.answerLength)) out.answerLength = 'standard';
    return out;
  }
  function conversation(name, value = {}) {
    return { id: uuid(), name: name || '新对话', createdAt: Date.now(), threadId: null, connectedEpoch: -1, messages: [], archived: false, ...value, documents: Array.isArray(value.documents) ? value.documents : [], settings: settings(value.settings) };
  }
  function migrate(saved = {}) {
    const map = new Map();
    for (const [key, value] of Object.entries(saved.sessions || {})) {
      if (Array.isArray(value.conversations)) {
        const conversations = value.conversations.map(s => conversation(s.name, { ...s, connectedEpoch: -1 }));
        map.set(key, { ...value, conversations, activeId: conversations.some(s => s.id === value.activeId) ? value.activeId : conversations[0]?.id });
      } else if (Array.isArray(value.messages)) {
        const chat = conversation('原有对话', { ...value, backendMode: 'continuous', settings: { historyMode: 'continuous', model: value.modelChoice || '' } });
        map.set(key, { title: value.title, conversations: [chat], activeId: chat.id });
      }
    }
    return map;
  }
  function boundedHistory(messages, options) {
    const s = settings(options); const rounds = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role !== 'user') continue;
      const a = messages[i + 1];
      if (a?.role === 'assistant' && a.status === 'completed') {
        const extra = a.artifact?.graph ? '\n图谱结构：' + JSON.stringify(a.artifact.graph) : '';
        rounds.push({ user: m.text, assistant: a.text + extra });
      }
    }
    if (!s.historyRounds || !s.historyChars) return { text: '', rounds: 0, chars: 0 };
    const chosen = []; let remaining = s.historyChars;
    for (const round of rounds.slice(-s.historyRounds).reverse()) {
      const text = '用户：' + round.user + '\n助手：' + round.assistant;
      if (text.length > remaining) {
        if (!chosen.length) {
          const marker='\n[该轮历史已截断]';
          chosen.unshift((text.slice(0,Math.max(0,remaining-marker.length))+marker).slice(0,remaining));
        }
        break;
      }
      chosen.unshift(text); remaining -= text.length + 2;
    }
    const text = chosen.join('\n\n'); return { text, rounds: chosen.length, chars: text.length };
  }
  function exportMarkdown(chat, title) {
    return '# ' + (chat.name || 'Codex 对话') + '\n\n文献：' + title + '\n\n' + chat.messages.map(m => {
      let text = '## ' + (m.role === 'user' ? '我' : 'Codex') + '\n\n' + (global.CodexRichText?.readable(m.text)||m.text);
      if (m.images?.length) text += '\n\n附件：' + m.images.map(i => i.name).join('、');
      if (m.documents?.length) text += '\n\n文档材料：' + m.documents.map(i => i.name).join('、');
      if (m.artifact?.graph) text += '\n\n```json\n' + JSON.stringify(m.artifact.graph, null, 2) + '\n```';
      if (m.study) text += '\n\n```json\n' + JSON.stringify(m.study, null, 2) + '\n```';
      if (m.generatedImages?.length) text += '\n\n生成图片：\n' + m.generatedImages.map(image=>'!['+image.name+']('+image.path.replace(/\\/g,'/')+')').join('\n');
      return text;
    }).join('\n\n');
  }
  global.CodexState = { defaults, settings, conversation, migrate, boundedHistory, exportMarkdown };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.CodexState;
})(this);
