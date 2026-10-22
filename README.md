# Codex for Zotero · 研桥

**简介：** Codex for Zotero · 研桥是一款面向 Windows 与 Zotero 10 的文献阅读工作台。它把 Zotero 文献、原始 PDF、本机 Codex 对话和研究产物连接起来，帮助读者阅读论文、比较文献、理解图表、生成科研示意图并开展交互学习。“研桥”是本项目的中文品牌名；仓库与插件 ID 延续 Codex for Zotero。

> **非官方项目声明：** 本插件由独立开发者维护，不由 Zotero / Corporation for Digital Scholarship、OpenAI 或 Codex 团队开发、授权、认证或背书。项目名称与图标用于说明兼容和集成关系，详见 [第三方声明](THIRD-PARTY-NOTICES.txt)。

## 0.6.5 下载

- [Windows 完整分享包](https://github.com/WinsDuan/codex-for-zotero/raw/refs/heads/main/downloads/Codex-for-Zotero-0.6.5-Windows.zip)：包含 XPI、离线安装说明和干净源码包。
- [Zotero 插件 XPI](https://github.com/WinsDuan/codex-for-zotero/raw/refs/heads/main/downloads/codex-for-zotero-0.6.5.xpi)
- [独立源码包](https://github.com/WinsDuan/codex-for-zotero/raw/refs/heads/main/downloads/codex-for-zotero-0.6.5-source.zip)
- [更新日志](CHANGELOG.md) · [原始 PDF 阅读指南](docs/原始PDF自动阅读.md)

SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| Windows ZIP | `ee43cb147eaa306c5432f7b640cfeb589f986a113f1e1738a3222ac80738347e` |
| XPI | `14a2cc3d8f92f434d9aceb081abdcca46991c618c0156cb01c2b9ea6aa82f1b5` |
| 源码 ZIP | `87ac37b2955b70c3d3b2b0058bee50683300eaeec4de25a7ec12928d15eb5e79` |

## 0.6.5 修复内容

- 修复“已连接但无法发送”：通过本地资源通道读取内置 PDF Skill，避免 Zotero 10 的 `NS_ERROR_FAILURE [nsIURI.username]` 异常。
- 修复 Codex 桌面版更新后旧程序路径失效：自动发现新的官方安装位置；有效自定义路径仍优先使用。
- 本机已完成真实发送与回复验证：原生 PDF 工具成功返回第 1 页文字和页面图像，覆盖状态为 1/16，无工具错误。本次没有把整篇标为已读。
- 35 项回归检查通过；沿用原插件 ID，安装时覆盖升级，保留对话和其他插件。

## 能做什么

- **论文对话：** 按文献建立多个独立对话，调节历史消息数量、字数预算和模型思考强度。
- **原始 PDF 图文阅读：** 复用 Zotero PDF.js，按页搜索、读取文字并按需返回真实页面图像；提供覆盖状态，区分已返回、缺失、无文字层和截断页。插件随包带有专用 PDF Skill 和 5 个原生工具。
- **图像理解与研究图：** 对话中加入图片；生成可编辑 SVG 科研图、论文思维导图和交互学习包。图片功能取决于当前 Codex 提供方及所选模型是否支持相应能力。
- **文献比较：** 添加 PDF、DOCX、文本等材料，并排阅读后按来源标注异同。
- **阅读体验：** 排版 Markdown、表格和数学公式；编辑已发送消息、管理对话文件，打开或定位生成的本地文件。
- **本机 Skill 与工作区：** 开始对话前选择本地保存目录，每个对话使用独立工作区；可以调用本机 Codex 实际提供的 Skill。

## 安装与使用

1. Windows 电脑需安装 Zotero 10.0.x，并安装、登录本机 Codex。
2. 在 Zotero 打开「工具 → 插件」，选择齿轮菜单中的「从文件安装插件」，选取 XPI。
3. 按 Zotero 提示重启后，点 Zotero 顶部的「研桥」入口或按 `Ctrl+Alt+C`。
4. 首次开始每条对话时选择保存位置。打开要读的 PDF 后，可直接询问论文正文或图表；查看回答下方的 PDF 阅读依据，确认页数和图像覆盖。

安装包附有完整离线说明；[原始 PDF 阅读指南](docs/原始PDF自动阅读.md)介绍了阅读依据和限制。

## PDF 阅读边界

组件读取原始 PDF 的页面文字和图像，并在对话中显示实际返回页码。页面全部返回不等于模型必然完整理解；图表解读还需要模型支持图片输入。请以阅读依据中的已读页、图像页、缺页及截断信息核对本轮材料。未返回的页面不会被表述成已读。

## 账号与本地数据

插件连接本机 Codex app-server，使用者以自己的 Codex 账号登录；无需在插件中创建 API Key。聊天和工作区文件默认保存在本机。发送请求时，所选论文材料、对话和附件会提交给当前 Codex 服务，处理方式还受该服务和账号设置约束。请不要分享个人 Zotero/Codex 配置目录或登录凭据。

项目源码采用 MIT 许可证；第三方依赖与图标按其各自许可和使用规范提供。构建要求、依赖和许可范围见源码包内文档。
