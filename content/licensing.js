(function(g) {
  'use strict';
  const {Services, Cc, Ci, IOUtils, PathUtils, Zotero} = g;
  const PRODUCT = 'codex-for-zotero';
  const MAX_FILE = 24000;
  const failure = message => new Error('插件授权：' + message);

  class LicenseManager {
    constructor(directory) {
      this.directory = directory;
      this.policy = g.CodexLicensePolicy;
      this.required = this.policy.edition === 'device-license-preview';
      this.path = PathUtils.join(directory, 'device-license.json');
      this.clockPath = PathUtils.join(directory, 'license-clock.json');
      this.status = {valid: !this.required, message: this.required ? '尚未激活' : '本地自用版'};
      this.lastSeen = 0;
      this.document = null;
    }
    window() {
      const win = Zotero.getMainWindow();
      if (!win?.crypto?.subtle) throw failure('无法使用系统签名校验，请在 Zotero 主窗口就绪后重试');
      return win;
    }
    encode(value) { return new (this.window().TextEncoder)().encode(value); }
    bytes(text) {
      if (typeof text !== 'string' || !/^[A-Za-z0-9_-]+$/.test(text)) throw failure('激活文件编码不正确');
      const bin = this.window().atob(text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '='));
      return Uint8Array.from(bin, c => c.charCodeAt(0));
    }
    base64(bytes) {
      return this.window().btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    async device() {
      if (Services.appinfo.OS === 'Darwin') {
        const {Subprocess}=g.ChromeUtils.importESModule('resource://gre/modules/Subprocess.sys.mjs');
        const process=await Subprocess.call({command:'/usr/sbin/ioreg',arguments:['-rd1','-c','IOPlatformExpertDevice'],stderr:'pipe'});
        const drain=async pipe=>{let text='',part;while((part=await pipe.readString()))text+=part;return text;};
        const [out,,result]=await Promise.all([drain(process.stdout),drain(process.stderr),process.wait()]);
        const id=out.match(/"IOPlatformUUID"\s*=\s*"([a-f0-9-]{32,40})"/i)?.[1];
        if(result.exitCode||!id)throw failure('无法读取 Mac 设备标识，请检查系统权限');
        const hash=await this.window().crypto.subtle.digest('SHA-256',this.encode(PRODUCT+':mac-platform:v1:'+id.toLowerCase()));
        return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
      }
      if (Services.appinfo.OS !== 'WINNT') throw failure('此授权版本尚未适配当前系统');
      // Read only a Windows installation identifier. Never transmit its raw value.
      const key = Cc['@mozilla.org/windows-registry-key;1'].createInstance(Ci.nsIWindowsRegKey);
      let id;
      try {
        key.open(key.ROOT_KEY_LOCAL_MACHINE, 'SOFTWARE\\Microsoft\\Cryptography', key.ACCESS_READ | key.WOW64_64);
        id = key.readStringValue('MachineGuid').trim().toLowerCase();
      } catch { throw failure('无法读取 Windows 设备标识，请检查系统权限；不会改用可随意复制的随机设备码'); }
      finally { key.close(); }
      if (!/^[a-f0-9-]{20,64}$/.test(id)) throw failure('Windows 设备标识格式异常');
      const hash = await this.window().crypto.subtle.digest('SHA-256', this.encode(PRODUCT + ':windows-machine:v1:' + id));
      return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
    }
    async requestCode() {
      const payload = {v: 1, product: PRODUCT, device: await this.device(), platform: Services.appinfo.OS==='Darwin'?'macos':'windows', createdAt: new Date().toISOString()};
      return 'CZR1.' + this.base64(this.encode(JSON.stringify(payload)));
    }
    async initialize() {
      if (!this.required) return this.status;
      try {
        if (await IOUtils.exists(this.clockPath)) {
          const clock = JSON.parse(await IOUtils.readUTF8(this.clockPath));
          if (Number.isFinite(clock.lastSeen)) this.lastSeen = clock.lastSeen;
        }
        if (await IOUtils.exists(this.path)) {
          const info = await IOUtils.stat(this.path);
          if (info.size > MAX_FILE) throw failure('激活文件过大');
          this.document = JSON.parse(await IOUtils.readUTF8(this.path));
        }
        await this.check();
      } catch (e) { this.status = {valid: false, message: e.message}; }
      return this.status;
    }
    async verify(document) {
      const token = typeof document === 'string' ? document.trim() : document?.token;
      if (typeof token !== 'string' || token.length > MAX_FILE) throw failure('激活文件内容不正确');
      const parts = token.split('.');
      if (parts.length !== 3 || parts[0] !== 'CZL1') throw failure('请选择 .czlicense 激活文件');
      const raw = this.bytes(parts[1]), signature = this.bytes(parts[2]);
      if (signature.length !== 64) throw failure('签名格式不正确');
      const subtle = this.window().crypto.subtle;
      const key = await subtle.importKey('jwk', this.policy.publicKey, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
      if (!await subtle.verify({name: 'ECDSA', hash: 'SHA-256'}, key, signature, raw)) throw failure('签名无效，文件可能被修改或由其他发行者签发');
      const payload = JSON.parse(new (this.window().TextDecoder)('utf-8', {fatal: true}).decode(raw));
      if (payload.v !== 1 || payload.product !== PRODUCT || payload.keyId !== this.policy.keyId) throw failure('产品或发行密钥不匹配');
      if (typeof payload.licenseId !== 'string' || !payload.licenseId || typeof payload.customerId !== 'string' || !payload.customerId || typeof payload.customer !== 'string' || !payload.customer || payload.seats !== 1) throw failure('授权资料不完整');
      if (payload.device !== await this.device()) throw failure('此激活文件属于另一台电脑，请为当前设备申请授权');
      const now = Date.now(), issued = Date.parse(payload.issuedAt), expires = Date.parse(payload.expiresAt);
      if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued) throw failure('授权日期不正确');
      if (issued > now + 5 * 60000) throw failure('授权尚未生效，请核对电脑时间');
      if (now >= expires) throw failure('授权已到期，请联系发行者续期');
      if (now + 10 * 60000 < this.lastSeen) throw failure('检测到系统时间明显回退，请校准时间后重试');
      return payload;
    }
    async check() {
      if (!this.required) return this.status;
      try {
        if (!this.document) throw failure('尚未激活，请点击“授权”导出设备申请码并导入专属激活文件');
        const payload = await this.verify(this.document);
        const now = Date.now();
        if (now - this.lastSeen > 60000) {
          this.lastSeen = Math.max(now, this.lastSeen);
          await IOUtils.writeUTF8(this.clockPath, JSON.stringify({lastSeen: this.lastSeen}), {tmpPath: this.clockPath + '.tmp'});
        }
        this.status = {valid: true, message: '已授权 · ' + payload.customer, payload};
        return this.status;
      } catch (e) {
        this.status = {valid: false, message: e.message};
        throw e;
      }
    }
    async activate(document) {
      // Do not replace a working license with an invalid import.
      await this.verify(document);
      const canonical = {token: typeof document === 'string' ? document.trim() : document.token};
      await IOUtils.writeUTF8(this.path, JSON.stringify(canonical), {tmpPath: this.path + '.tmp'});
      this.document = canonical;
      return this.check();
    }
  }
  g.CodexLicenseManager = LicenseManager;
})(this);
