# Codex for Zotero · 研桥 · 分享版源码

这是随 Windows 安装包提供的干净源码。普通用户只需在 Zotero 安装 XPI，不需要构建。

## 目录

- `manifest.json`、`bootstrap.js`：Zotero 插件入口。
- `content/`：Codex 通信、文献上下文、聊天、Markdown/MathML、SVG 图谱与交互学习。
- `icons/`、`locale/`：图标和语言资源。
- `build.ps1`：使用 PowerShell 7+ 构建 XPI。
- `tests/`：已有 Node.js 内置测试文件。
- `packaging/`：Windows 文档、检查工具、干净发布包生成器。
- `使用说明.md`：工作区的插件功能说明。

开发文库、个人 Zotero 配置、安装备份、日志、认证文件、真实论文/聊天、临时验证插件均不包含在此源码中。使用说明中提到的 `dev/` 是作者本地验证工具，本分享版不提供该目录。

## 构建

需要 PowerShell 7+。在源码目录运行：

```powershell
pwsh -NoProfile -File .\build.ps1
```

生成 `dist/codex-for-zotero-0.6.5.xpi`。构建只包含 manifest、bootstrap、content、icons、locale，不写入用户配置。

需要重新整理 Windows 分享包时，另安装 Python 3.10+，运行：

```powershell
python .\packaging\build_windows_release.py
```

打包器会检查 XPI 文件清单及其源码内容，严格按允许清单组装发布目录、源码 ZIP、文件 SHA256 和 Windows ZIP。它不调用模型、不运行测试、不读取 Zotero 或 Codex 用户目录。

`tests/` 没有额外 npm 依赖；需要做开发验证时可手动使用 Node.js 内置 test runner。重新构建不等于完成真实 Zotero/Codex 集成验证。

## 接口和兼容性

通过本机 `codex.exe app-server --listen stdio://` 连接当前用户已有登录，未在插件内复制或分发登录令牌。当前清单限定 Zotero 10.0.x。协议升级可能需要跟进适配。

`manifest.json` 中的更新 URL 是占位地址；此版本采用手动 XPI 更新。若将来建立公开更新服务，需要由作者提供真实地址和发布流程。

第三方组件许可证见 `content/vendor/`。本项目延续公开仓库的 MIT 许可证，见随包 LICENSE。参考 Windows 分享包中的 THIRD-PARTY-NOTICES.txt。
