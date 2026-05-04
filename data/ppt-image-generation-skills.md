# PPT 生图路线 Skill 调研

调研时间：2026-04-25

本文整理“做 PPT 的 skill 里哪些是走生图路线”的联网检索结论。这里的“生图路线”主要指：不是用 PPTX 元素逐个搭建可编辑页面，而是把每一页或主要视觉区域作为图片生成、截图或栅格化后再打包进 PPT/PDF。

## 结论概览

### 明确是页级生图路线

| Skill                                         | 结论                                           | 路线                                                                            | 适合场景                                             |
| --------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `ppt-generator-pro` / `NanoBanana PPT Skills` | 最典型的“整页 PPT 生图”                        | 文档/主题 -> `slides_plan.json` -> 每页生成一张 PPT 图片 -> 可选转场视频/播放器 | 追求视觉效果、汇报展示、海报式 PPT，不强调逐字可编辑 |
| `baoyu-slide-deck`                            | 明确生成 slide deck images                     | 内容 -> 大纲 -> prompts -> 生成图片 -> 合并到 PPTX/PDF                          | 想要一页一图的完整 deck，且需要 PPTX/PDF 打包        |
| `pw-image-generation`                         | 不是专门 PPT skill，但支持“每页图像打包成 PPT” | prompts -> 批量生图 -> `merge-to-pptx` 一图一页                                 | 做视觉型 PPT、插画型课件、图文长图转 PPT             |

### 混合路线：PPT 生成里带 AI 配图/局部生图

| Skill                                     | 结论                                     | 路线                                                     | 适合场景                                   |
| ----------------------------------------- | ---------------------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| `ppt-master`                              | 主路线是 SVG 页面生成，AI 生图是条件阶段 | 文档 -> 设计规格 -> 可选 AI 图片生成 -> SVG 页面 -> PPTX | 想要结构化高质量 PPT，同时需要部分 AI 配图 |
| `Report Ppt Generator Pro` / ClawHub 版本 | 主路线是可编辑 PPT，AI 配图是可选依赖    | HTML/PPTX 生成 + 可选 `nanobanana-skill` 配图            | 想保留 PPT 可编辑性，只用 AI 图增强视觉    |
| `ppt` by tsaol                            | 不是 AI 生图，但也是“图片页”路线         | HTML slide -> Puppeteer 截图 -> 图片塞进 PPTX            | 想用 HTML/CSS 设计整页，再栅格化到 PPTX    |

### 不属于生图路线或不建议归为生图

| Skill                               | 原因                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `pptx-generator` by MiniMax-AI      | 主要用 PptxGenJS 生成可编辑 PPTX 元素，不是生图路线。                                      |
| `ai-ppt-generate` by openclaw/Baidu | 调百度 AI PPT API 生成最终 `.pptx`，检索到的信息更像模板/大纲/API 生成，不是页级生图路线。 |
| `frontend-slides`                   | 主要生成 HTML 演示，PDF 导出会截图，但它不是 AI 生图 PPT。                                 |

## 重点来源

### NanoBanana PPT Skills / ppt-generator-pro

`NanoBanana PPT Skills` 的 GitHub README 和相关 skill 页面显示，它会先生成 `slides_plan.json`，再调用脚本生成 PPT 图片，并可选生成转场视频。因此它最符合“每页 PPT 直接由图像模型生成成 16:9 图片”的路线。

来源：

- [GitHub: op7418/NanoBanana-PPT-Skills](https://github.com/op7418/NanoBanana-PPT-Skills)
- [SkillKit: ppt-generator-pro Claude Code Skill](https://skillkit.io/skills/claude-code/ppt-generator-pro-claude-code-skill)
- [AwesomeSkill: NanoBanana PPT Skills](https://awesomeskill.ai/skill/nanobanana-ppt-skills-)

注意：AwesomeSkill 页面给它标了较高安全风险，包括环境变量/密钥、shell 配置修改、`sudo` 等命中项。实际安装前建议人工审查 `SKILL.md`、安装脚本和 `.env` 处理逻辑。

### baoyu-slide-deck

`baoyu-slide-deck` 页面描述为将内容转换成 professional slide deck images，workflow 中明确包含生成图片以及合并到 PPTX/PDF 的步骤。它属于完整的“图片页 deck”生成路线。

来源：

- [MCP.Directory: baoyu-slide-deck](https://mcp.directory/skills/baoyu-slide-deck)

### pw-image-generation

`pw-image-generation` 不是专门的 PPT skill，但说明里覆盖文生图、图生图、批量生成、长图合并和 PPT 打包。示例路线是生成每页图片，再打包为 PPTX。

来源：

- [Playbooks: pw-image-generation](https://playbooks.com/skills/plugins-world/pw-skills/pw-image-generation)

### ppt-master

`ppt-master` 的 `SKILL.md` 显示核心管线包含 `[Image_Generator]`，但 AI 图片生成不是无条件主流程，而是在设计里的图片策略包含 AI generation 时触发。它最终主产物更偏 SVG 页面和 PPTX 导出，所以归为混合路线。

来源：

- [GitHub: hugohe3/ppt-master SKILL.md](https://github.com/hugohe3/ppt-master/blob/main/skills/ppt-master/SKILL.md)

### ppt by tsaol

`ppt` by tsaol 推荐 HTML to PPTX 工作流，用 Puppeteer 把 HTML 截图为 PNG，再通过 `slide.addImage` 放进 PPTX。它不是 AI 生图，但在产物结构上是“一页图片”路线。

来源：

- [MCP.Directory: ppt](https://mcp.directory/skills/ppt)

### pptx-generator by MiniMax-AI

`pptx-generator` 主要用 PptxGenJS 创建/编辑 PPTX、XML 工作流和 markitdown 提取内容，目标是生成可编辑的 PPTX 元素，不是页级生图路线。

来源：

- [GitHub: MiniMax-AI/skills pptx-generator](https://github.com/MiniMax-AI/skills/blob/main/skills/pptx-generator/SKILL.md)

### ai-ppt-generate

`ai-ppt-generate` 使用百度 PPTThemeQuery / PPTOutlineGenerate / PPTGenerate API，最终拿到 PPT 文件 URL。检索到的信息更像模板/大纲/API 生成，不足以归为“每页生图”路线。

来源：

- [Playbooks: ai-ppt-generate](https://playbooks.com/skills/openclaw/skills/ai-ppt-generate)

## 推荐判断

如果目标是“整页 PPT 生图”，优先看：

1. `NanoBanana PPT Skills` / `ppt-generator-pro`
2. `baoyu-slide-deck`
3. `pw-image-generation`

如果目标是“保留 PPT 可编辑结构，同时增强视觉”，优先看：

1. `ppt-master`
2. `Report Ppt Generator Pro`
3. `pptx-generator`

如果目标是“用 HTML/CSS 设计每页，再导出图片页 PPT”，可以看：

1. `ppt` by tsaol
2. `frontend-slides`

## 简短建议

对视觉表现要求最高、可编辑性要求低：选 `NanoBanana PPT Skills` 或 `baoyu-slide-deck`。

对安全和可控性要求高：不要直接安装未知 skill，先审查 `SKILL.md`、脚本、环境变量读取、网络请求、shell 修改和外部二进制依赖。

对后期可编辑性要求高：不要走整页生图路线，改用 PptxGenJS / SVG / HTML 混合方案，只在配图和封面视觉上使用生图。
