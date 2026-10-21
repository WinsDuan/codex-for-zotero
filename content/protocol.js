(function (global) {
  'use strict';

  class CodexRpcClient {
    constructor(options) {
      this.factory = options.transportFactory;
      this.timers = options.timers || { setTimeout, clearTimeout };
      this.version = options.version || '0.2.0';
      this.log = options.log || (() => {});
      this.requestHandler=options.requestHandler||null;
      this.listeners = new Set();
      this.pending = new Map();
      this.turns = new Map();
      this.seq = 0;
      this.epoch = 0;
      this.transport = null;
      this.connecting = null;
      this.ready = false;
      this.buffer = '';
    }

    onEvent(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    emit(method, params) {
      for (const listener of this.listeners) {
        try { listener({ method, params }); } catch (error) { this.log(error.message); }
      }
    }

    async connect() {
      if (this.ready) return this.info;
      if (this.connecting) return this.connecting;
      const epoch = ++this.epoch;
      this.buffer = '';
      this.connecting = (async () => {
        try {
          this.transport = await this.factory({
            onChunk: chunk => { if (this.epoch === epoch) this.receive(chunk); },
            onExit: error => { if (this.epoch === epoch) this.disconnect(error || new Error('Codex 进程已退出')); },
          });
          this.info = await this.request('initialize', {
            clientInfo: { name: 'codex_for_zotero', title: 'Codex for Zotero', version: this.version },
            capabilities: { experimentalApi: true },
          }, 30000);
          await this.notify('initialized', {});
          this.ready = true;
          this.emit('transport/ready', this.info);
          return this.info;
        } catch (error) {
          await this.close(error);
          throw error;
        } finally { this.connecting = null; }
      })();
      return this.connecting;
    }

    request(method, params = {}, timeout = 60000) {
      if (!this.transport) return Promise.reject(new Error('Codex 尚未连接'));
      const id = 'zotero-' + (++this.seq);
      return new Promise((resolve, reject) => {
        const timer = this.timers.setTimeout(() => {
          this.pending.delete(id);
          reject(new Error('Codex 请求超时：' + method));
        }, timeout);
        this.pending.set(id, { resolve, reject, timer });
        Promise.resolve(this.transport.write(JSON.stringify({ id, method, params }) + '\n')).catch(error => {
          const waiter = this.pending.get(id);
          if (waiter) { this.timers.clearTimeout(waiter.timer); this.pending.delete(id); waiter.reject(error); }
        });
      });
    }

    notify(method, params) {
      if (!this.transport) return Promise.reject(new Error('Codex 尚未连接'));
      return this.transport.write(JSON.stringify({ method, params }) + '\n');
    }

    receive(chunk) {
      this.buffer += chunk;
      // An image tool item can contain up to 70 MB of base64 data in one line.
      // Keep the transport limit above the image decoder's limit, including JSON.
      if (this.buffer.length > 96 * 1024 * 1024) { this.disconnect(new Error('Codex 响应超过 96 MB 消息缓冲上限')); return; }
      let newline;
      while ((newline = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, newline).trim();
        this.buffer = this.buffer.slice(newline + 1);
        if (!line) continue;
        let message;
        try { message = JSON.parse(line); } catch { this.log('Ignored non-JSON app-server output'); continue; }
        if (message.method && message.id !== undefined) { void this.answerServerRequest(message); continue; }
        if (message.id !== undefined && this.pending.has(message.id)) {
          const waiter = this.pending.get(message.id);
          this.pending.delete(message.id); this.timers.clearTimeout(waiter.timer);
          if (message.error) {
            const error = new Error(message.error.message || 'Codex 返回错误');
            error.code = message.error.code;
            error.codexErrorInfo = message.error.data?.codexErrorInfo || message.error.codexErrorInfo;
            waiter.reject(error);
          } else waiter.resolve(message.result || {});
        } else if (message.method) this.emit(message.method, message.params || {});
      }
    }

    async answerServerRequest(message) {
      let result;
      if(this.requestHandler)try{result=await this.requestHandler(message);}catch(e){this.log('Client input: '+e.message);}
      if (!result&&message.method === 'item/permissions/requestApproval') result = { permissions: {}, scope: 'turn' };
      else if (!result&&/requestApproval$/.test(message.method)) result = { decision: 'decline' };
      else if (!result&&/elicitation\/request$/.test(message.method)) result = { action: 'decline', content: null };
      else if (!result&&/requestUserInput$/.test(message.method)) result = { answers: {} };
      const response = result ? { id: message.id, result } : {
        id: message.id, error: { code: -32601, message: 'Unsupported client request' },
      };
      try { if (this.transport) await this.transport.write(JSON.stringify(response) + '\n'); }
      catch (error) { this.log(error.message); }
      this.emit('client/requestAnswered', { method: message.method });
    }

    runTurn(params, options = {}) {
      const threadId = params.threadId;
      if (this.turns.has(threadId)) return Promise.reject(new Error('该文献已有一个正在进行的回答'));
      const state = { turnId: null, messages: new Map(), items: new Map(), error: null, interruptRequested: false, interruptSent: false };
      this.turns.set(threadId, state);
      return new Promise((resolve, reject) => {
        let settled = false;
        let timer;
        const text = () => {
          const messages = [...state.messages.values()];
          const answers = messages.filter(item => item.phase !== 'commentary');
          return (answers.length ? answers : messages).map(item => item.text || '').filter(Boolean).join('\n\n');
        };
        const finish = (error, turn) => {
          if (settled) return;
          settled = true; off(); this.timers.clearTimeout(timer); this.turns.delete(threadId);
          const result = { text: text(), items: [...state.items.values()], status: turn?.status || 'failed', turnId: state.turnId, threadId };
          if (error) { error.partialText = result.text; error.partialItems=result.items; reject(error); } else resolve(result);
        };
        const update = () => options.onText?.(text());
        const off = this.onEvent(({ method, params: data }) => {
          if (method === 'transport/closed') { finish(new Error(data.message)); return; }
          if (data.threadId && data.threadId !== threadId) return;
          if (state.turnId && data.turnId && data.turnId !== state.turnId) return;
          if (method === 'turn/started' && data.turn) {
            state.turnId = data.turn.id;
            if (state.interruptRequested) void this.interrupt(threadId).catch(error => this.log(error.message));
          }
          else if (method === 'item/started' || method === 'item/completed') {
            if(data.item?.id)state.items.set(data.item.id,data.item);
            if (data.item?.type === 'agentMessage') {
              state.messages.set(data.item.id, { ...data.item }); update();
            }
          } else if (method === 'item/agentMessage/delta') {
            const id = data.itemId || 'reply';
            const message = state.messages.get(id) || { id, text: '', phase: null };
            message.text += data.delta || ''; state.messages.set(id, message); update();
          } else if (method === 'error') state.error = data.error;
          else if (method === 'turn/completed' && data.turn) {
            if (state.turnId && data.turn.id !== state.turnId) return;
            for (const item of data.turn.items || []) {if(item.id)state.items.set(item.id,item);if (item.type === 'agentMessage') state.messages.set(item.id, { ...item });}
            update();
            if (data.turn.status === 'failed') {const error=new Error(data.turn.error?.message || state.error?.message || 'Codex 回答失败');error.codexErrorInfo=data.turn.error?.codexErrorInfo||state.error?.codexErrorInfo;finish(error,data.turn);}
            else finish(null, data.turn);
          }
          options.onEvent?.(method, data);
        });
        timer = this.timers.setTimeout(() => {
          void this.interrupt(threadId).catch(() => {});
          const error=new Error('等待 Codex 超过本地时限，已请求停止。此提示不代表上下文已满；已收到的文字和图片会保留。');error.code='localTimeout';finish(error);
        }, options.timeout || 300000);
        this.request(options.startMethod||'turn/start', params).then(result => {
          state.turnId = result.turn?.id || state.turnId;
          if (!settled && state.interruptRequested) void this.interrupt(threadId).catch(error => finish(error));
        }).catch(error => finish(error));
      });
    }

    async interrupt(threadId) {
      const state = this.turns.get(threadId);
      if (!state) return false;
      state.interruptRequested = true;
      if (!state.turnId || state.interruptSent) return false;
      state.interruptSent = true;
      try {
        for (let attempt = 0; attempt < 10; attempt++) {
          if (this.turns.get(threadId) !== state) return false;
          try {
            await this.request('turn/interrupt', { threadId, turnId: state.turnId }, 10000);
            return true;
          } catch (error) {
            if (!/no active turn/i.test(error.message) || attempt === 9) throw error;
            await new Promise(resolve => this.timers.setTimeout(resolve, 100));
          }
        }
      } catch (error) { state.interruptSent = false; throw error; }
    }

    disconnect(error = new Error('Codex 连接已关闭')) {
      this.ready = false;
      for (const waiter of this.pending.values()) { this.timers.clearTimeout(waiter.timer); waiter.reject(error); }
      this.pending.clear();
      this.emit('transport/closed', { message: error.message });
    }

    async close(error = new Error('Codex 连接已关闭')) {
      const transport = this.transport;
      this.transport = null; this.epoch++;
      this.disconnect(error);
      if (transport) { try { await transport.close(); } catch (e) { this.log(e.message); } }
    }
  }

  global.CodexRpcClient = CodexRpcClient;
  if (typeof module !== 'undefined' && module.exports) module.exports = { CodexRpcClient };
})(this);
