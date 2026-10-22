# Codex for Zotero · 研桥 0.6.6 · macOS

这是 macOS 适配分享包。插件采用 Zotero 原生 XPI 格式，同一份 JavaScript 插件适用于 Apple Silicon 与 Intel；Codex 引擎需要用户按自己 Mac 的架构单独安装。包内不包含模型、Codex 应用或登录凭据。

## 先从这里开始

1. 在 Mac 上安装 **Zotero 10.0.x**，并安装、登录本机 **Codex**。
2. 解压本分享包，在 Zotero 打开 **工具 → 插件**，点齿轮菜单 **从文件安装插件…**，选择 `codex-for-zotero-0.6.6.xpi`。不要解压 XPI。
3. 用 **⌘Q 完全退出 Zotero** 后重新打开。Mac 上仅点窗口左上角红点可能不会退出程序。
4. 打开一篇本地 PDF，点击 Zotero 顶部 **研桥**，或按 **⌘⌥C** 打开面板。
5. 显示 **已连接 · ChatGPT** 后，选择此对话保存位置，即可提问。每条对话在所选父目录建立独立子文件夹。

Zotero 官方最低系统要求见 [系统要求](https://www.zotero.org/support/system_requirements)。还需满足所安装 Codex 版本自身的系统和架构要求；能启动 Zotero 不代表一定能启动 Codex。

## Mac 上怎样找 Codex

程序路径通常留空。插件检查系统和用户的 Applications、Apple Silicon 与 Intel 常见 Homebrew 路径，再检查 PATH。支持：

```text
/Applications/Codex.app/Contents/Resources/codex
~/Applications/Codex.app/Contents/Resources/codex
/opt/homebrew/bin/codex
/usr/local/bin/codex
```

也会检查当前 ChatGPT 应用包中对应位置是否存在 Codex 引擎；这里只检查实际存在的程序，不保证每个应用发行版本都包含该文件。如果安装位置不同，在研桥右上角 **⚙ → Codex 程序路径** 填入实际 `codex` 文件完整路径，再保存重连。可以填写 `Codex.app` 路径，插件会查找其 Resources 内的引擎。

从 Finder 启动 Zotero 时，PATH 可能与终端不同。插件会补入常用 Homebrew 和系统工具路径。使用 nvm、自定义 npm 前缀或其他开发环境时，可先运行 `command -v codex` 确认位置；若脚本依赖的 Node 无法从图形应用找到，优先使用桌面应用内置引擎或可直接运行的原生 Codex 程序。

### 一键检查环境

双击同目录 **检查环境.command**。它检查 Mac 架构、Zotero 安装、Codex 版本、app-server 命令和登录状态，将 JSON 报告保存到桌面。不会发送模型请求，不读取论文、聊天或登录令牌。

若系统阻止运行，先确认文件来自本仓库，再按 macOS 提示单独允许打开。也可在终端执行：

```zsh
/bin/zsh "/你解压的位置/Codex-for-Zotero-0.6.6-macOS/检查环境.command"
```

路径中有中文、空格时保留引号。不要用 `sudo`。`environment-ready` 只代表基础环境正常，仍需在 Zotero 里发送一次请求，不能当作完整适配证明。

## 使用功能

| 功能 | Mac 操作 |
| --- | --- |
| 打开研桥 | 顶部入口或 ⌘⌥C |
| 发送 / 换行 | Enter / Shift+Enter |
| 选择复制 | 鼠标选中输出后 ⌘C，或点消息“复制” |
| 资料与图片 | ＋、拖入 PDF/DOCX/文本/图片；粘贴图片 |
| 多篇阅读 | 添加第二篇资料，再选择“对比”或“文献对比” |
| PDF 图文阅读 | 自动接入当前 PDF，通过原生工具读取页面文字和真实页面图像 |
| 图片查看 | 点击预览图进入图片阅读器，缩放、平移或导出 |
| 本地 Skill | 在设置中读取本机 Skill，选定工作区和工具权限后使用 |
| 打开产物 | 点击文件卡或 Markdown 文件链接；普通路径按 ⌘ 点击 |
| Finder 定位 | 文件卡“定位”，或路径链接右键 |
| 编辑消息 | 用户消息旁“编辑”，创建新版本并保留原版本 |
| 清理文件 | 选择要清理的文件，默认移入 Mac 废纸篓；符合撤销条件时可恢复 |

聊天、历史、工具、学习、文件、对比等页面与 Windows 版共用前端。模型列表、思考强度、图片理解、生图、工具和 Skill 能力由用户实际连接的 Codex 服务决定。插件不能保证任意账号均有某个点名的图片模型。

## PDF 阅读怎样确认

在打开 PDF 后，可以发送：

> 请使用原始 PDF 工具读取第 1 个物理页的文字和页面图像，调用 research_pdf_status，并告诉我实际读取范围。不要声称读过其余页面。

回答下方应出现 **PDF 阅读依据**，包括物理页和印刷页标签、文字页数、图像页数。再要求它解释某一张图，并核对返回记录确实包含对应页的图像。只有工具真实覆盖全部页面时，才能说本轮全部图文已返回；这也不等于模型必然完整理解所有细节。

## 文件、权限与清理

建议首次验收时选 `~/Documents/研桥验收`，使用小型非敏感 PDF。Mac 询问 Zotero 对文稿、下载等目录的访问权限时，只需允许你选择的资料目录。没有必要为插件授予辅助功能或全磁盘访问权限。

文件清理使用 macOS Foundation 的原生废纸篓接口，不调用 Finder 自动化或 PowerShell。保护来源原件、其他对话或保留版本仍引用的文件。外置磁盘、网络盘、云盘或权限限制可能导致移入废纸篓失败；失败会提示，不会自动改为永久删除。废纸篓已清空、文件已被外部移动或原位置被占用时，不能撤销。

文件名区分大小写的 APFS 也保留真实路径大小写。`.app`、`.command`、脚本等可执行产物需先定位到 Finder，由用户自行决定是否运行。

## 更新旧版

直接安装新版 XPI 后 ⌘Q 退出重开，无需卸载旧插件。插件 ID 不变。请保留自己的工作区，不要用他人的 Zotero/Codex 配置目录覆盖本机目录。此版本是公开普通版；没有捆绑发行者私钥或他人的账号。

## 如何判断已适配

请按随包 **Mac验收步骤.md** 检查。自动检查结果与尚未覆盖的范围见 **验证状态.md**。Zotero 界面、Mac 权限、用户账号和模型工具响应需要实际 Mac 上的完整操作才能确认。

## 包内文件

- `codex-for-zotero-0.6.6.xpi`：安装到 Zotero 的插件。
- `开始这里.html`：离线安装说明。
- `检查环境.command`、`check-environment.js`：Mac 环境诊断工具。
- `Mac验收步骤.md`、`验证状态.md`：验收方法与已完成验证的范围。
- `codex-for-zotero-0.6.6-source.zip`：允许清单生成的干净源码，普通用户不需要构建。
- `SHA256SUMS.txt`、`LICENSE`、`THIRD-PARTY-NOTICES.txt`：校验值与许可证。

## 技术依据

本插件通过 [Codex App Server](https://learn.chatgpt.com/docs/app-server) 与用户本机 Codex 通信。macOS 文件清理使用 Apple 的 [NSFileManager trashItemAtURL](https://developer.apple.com/documentation/foundation/filemanager/trashitem(at:resultingitemurl:)?language=objc)。
