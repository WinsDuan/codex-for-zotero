window.addEventListener('load', async () => {
  'use strict';
  const {controller: c} = window.arguments[0], manager = c.licensing;
  const $ = id => document.getElementById(id);
  const act = fn => async () => {
    $('error').textContent = '';
    const controls = [...document.querySelectorAll('button')];
    controls.forEach(b => b.disabled = true);
    try { await fn(); }
    catch (e) { $('error').textContent = e.message; }
    finally { controls.forEach(b => b.disabled = false); c.refreshViews(); }
  };
  async function refresh() {
    await manager.check().catch(() => {});
    const {valid, message, payload} = manager.status;
    $('status').textContent = message;
    $('details').textContent = valid && payload ? '客户编号：' + payload.customerId + '\n授权编号：' + payload.licenseId + '\n到期时间：' + new Date(payload.expiresAt).toLocaleString() : '';
    $('request').value = await manager.requestCode();
  }
  $('copy').addEventListener('click', act(async () => {
    if (!$('request').value) throw new Error('设备申请码尚未生成，请先刷新状态');
    c.copyText($('request').value); $('status').textContent = '申请码已复制';
  }));
  $('save').addEventListener('click', act(async () => {
    const dest = await c.chooseSave(window, '设备授权申请.czrequest', 'czrequest');
    if (dest) await IOUtils.writeUTF8(dest, $('request').value);
  }));
  $('import').addEventListener('click', act(async () => {
    const {FilePicker} = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');
    const picker = new FilePicker(); picker.init(window, '导入设备激活文件', picker.modeOpen);
    picker.appendFilter('设备激活文件', '*.czlicense');
    if (await picker.show() === picker.returnCancel || !picker.file) return;
    if ((await IOUtils.stat(picker.file)).size > 24000) throw new Error('激活文件过大');
    const raw = await IOUtils.readUTF8(picker.file);
    const document = raw.trim().startsWith('{') ? JSON.parse(raw) : raw;
    await manager.activate(document); await refresh();
    // Connecting is read-only account discovery; no model turn is submitted.
    await c.connect().catch(e => { $('error').textContent = '已激活；Codex 连接提示：' + c.friendlyError(e); });
  }));
  $('refresh').addEventListener('click', act(refresh));
  await act(refresh)();
}, {once: true});
