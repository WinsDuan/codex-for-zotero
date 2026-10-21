# Codex for Zotero 0.6.0 — 源码发布说明

这是 Codex for Zotero 的干净源码目录。当前版本面向 Windows 上的 Zotero 10.0.x，通过本机 Codex app-server 工作；尚未接入 DeepSeek 或其他服务商的 API。普通使用者无需本地构建；如需预编译 XPI，请查看仓库后续发布的 Release 说明。本仓库当前先发布源码。

> **非官方项目声明：** 本插件由独立开发者维护，不由 Zotero / Corporation for Digital Scholarship、OpenAI 或 Codex 团队开发、授权、认证或背书。名称和图标仅用于说明兼容与集成关系。详见根目录 `THIRD-PARTY-NOTICES.txt`。

本项目原创代码和文档采用根目录 `LICENSE` 中的 MIT 许可证。第三方组件、图标和名称适用各自许可证或使用规范，详见 `THIRD-PARTY-NOTICES.txt` 与组件目录中的来源信息。

## 目录

- `manifest.json`、`bootstrap.js`：Zotero 插件入口和版本兼容范围。
- `content/`：Codex app-server 通信、文献上下文、对话工作台、Markdown/MathML、SVG 图谱与交互学习功能。
- `icons/`、`locale/`：界面图标及语言资源，含图标来源说明。
- `tests/`：Node.js 内置测试。
- `build.ps1`：使用 PowerShell 7+ 构建 XPI。
- `packaging/`：Windows 使用文档、环境检查和 Windows 分享包打包器。
- `README.md`：完整功能、使用方式和已知限制。
- `LICENSE`、`THIRD-PARTY-NOTICES.txt`：项目许可证和第三方声明。

发布源码不包含开发文库和 Zotero/Codex 用户配置、浏览器数据库、认证凭据、真实论文/聊天、日志、构建包、设备授权签发工具或签发私钥。

## 构建插件

需要 PowerShell 7+。在源码目录运行：

```powershell
pwsh -NoProfile -File .\build.ps1
```

生成 `dist/codex-for-zotero-0.6.0.xpi`。构建仅打包 `manifest.json`、`bootstrap.js`、`content/`、`icons/`、`locale/` 中的插件文件，不读取 Zotero/Codex 用户配置。

## 构建 Windows 分享包

需要 Python 3.10+ 和先构建好的 XPI：

```powershell
python .\packaging\build_windows_release.py
```

打包器依据源码允许清单核对 XPI 内容，然后生成包含离线文档、源码 ZIP、SHA256 清单和 XPI 的 Windows 分享包。脚本不读取用户配置、不调用模型，也不会运行自动化测试。

## 检查

仓库测试使用 Node.js 内置 test runner，无额外 npm 依赖：

```powershell
node --test tests/protocol.test.cjs tests/workbench.test.cjs tests/workspace.test.cjs tests/richtext.test.cjs
```

自动化测试通过不代表已完成所有 Zotero/Codex 版本和真实用户数据场景的集成回归。0.6.0 对消息重新生成、文件清理/恢复等新增交互仍需在各自环境中谨慎验证；当前实现边界见 README 和 `packaging/windows/版本说明.md`。

## 兼容范围

清单限定 Zotero 10.0.x，当前连接依赖本机可用并已登录的 Codex app-server。安装包不含 Zotero、Codex、模型、账号、登录令牌、论文或对话。app-server 协议、账号可用模型和本机配置发生变化时可能需要插件适配。此版本无自动更新服务，XPI 需手动更新。