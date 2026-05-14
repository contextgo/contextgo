---
name: infographic-image
description: >-
  将任意主题、长文、报告、纪要或说明文本稳定转换成中文视觉生图提示词，
  然后调用 DashScope Qwen 图像模型直接出图。适用于“把这段内容做成信息图”、
  “做成故事漫画长图”、“长文转图”、“生成中文生图 prompt”、“根据文档出图”
  等场景；默认采用白色磁吸会议板手写风格，也支持切换到其他内置模板。
compatibility:
  - 'Requires network access for prompt generation and image rendering.'
  - 'Requires environment variable `DASHSCOPE_API_KEY` for final image rendering.'
  - 'Requires command-line tool `python3`.'
  - 'Works best in Codex-compatible environments that can execute local scripts.'
---

# Infographic Image

## Overview

使用 `scripts/generate_infographic.py` 将任意输入内容压缩为稳定的中文视觉生图提示词，再调用 DashScope 默认模型 `qwen-image-2.0-pro` 出图并下载到本地。

## Quick Start

1. 配置 API Key：

```bash
export DASHSCOPE_API_KEY="<your_api_key>"
```

2. 从长文直接生成图像：

```bash
python3 scripts/generate_infographic.py \
  --text-file /absolute/path/article.md \
  --size "1440*1800"
```

3. 只生成稳定 prompt，不出图：

```bash
python3 scripts/generate_infographic.py \
  --text "这里放任意中文或英文内容" \
  --dry-run
```

4. 加载自定义风格补充：

```bash
python3 scripts/generate_infographic.py \
  --text-file /absolute/path/report.txt \
  --style-preset comic-story \
  --style-file /absolute/path/custom-style.md
```

## Workflow

1. 从 `--topic`、`--text` 或 `--text-file` 收集原始素材。
2. 从内置模板中选择一套协议与风格；若未指定，则默认使用白色磁吸会议板手写风格。
3. 可选叠加 `references/styles/*.md` 或外部风格文件作为补充。
4. 调用 DashScope 文本模型生成严格 JSON，提取 `image_generation_prompt`。
5. 使用默认模型 `qwen-image-2.0-pro` 渲染图像并保存到本地。
6. 若推理失败，使用脚本内置兜底模板生成可用 prompt。

## Key Files

- `references/meta-prompt.md`：信息图模板的元提示词。
- `references/meta-prompts-comic-story.md`：新中式漫画故事模板的元提示词。
- `references/styles/default.md`：信息图手绘笔记风格。
- `references/styles/clean-editorial.md`：信息图编辑排版风格。
- `references/styles/comic-story.md`：新中式漫画故事风格。
- `references/meta-prompts-spatial-gallery.md`：空间化画廊信息图模板的元提示词。
- `references/styles/spatial-gallery.md`：洁净实验室 / 画廊装置信息图风格。
- `references/meta-prompts-frosted-whiteboard.md`：白色磁吸会议板手写图模板的元提示词。
- `references/styles/frosted-whiteboard.md`：白色磁吸会议板 + 手写板书风格。
- `scripts/generate_infographic.py`：统一入口脚本。

## Extend Styles

内置模板当前包含 `default`、`clean-editorial`、`comic-story`、`spatial-gallery`、`frosted-whiteboard`。其中 `default` 默认就是白色磁吸会议板手写风格；如需随机，可显式传 `--style-preset random`。新增模板时，优先补齐对应协议与风格文件；如果只是临时试验，也可以直接传 `--style-file` 或 `--style-hint`。

## High-Value Options

- `--topic`：简短主题。
- `--text`：直接传长文本。
- `--text-file`：从本地文件读取正文。
- `--style-preset`：选择内置模板，如 `default`、`clean-editorial`、`comic-story`、`spatial-gallery`、`frosted-whiteboard`；留空走默认，传 `random` 才随机。
- `--style-file`：加载外部风格文件。
- `--style-hint`：临时补充风格偏好。
- `--dry-run`：只输出推理出的 prompt 和负面提示词，不调用生图。
- `--prompt-output`：将推理结果 JSON 保存到本地。
- `--size`：输出尺寸，如 `1440*1800`、`1664*928`、`1328*1328`。
- `--prompt-model`：提示词推理模型，默认 `qwen-plus`。
- `--image-model`：可选覆盖生图模型；默认 `qwen-image-2.0-pro`，通常无需修改。

## Reliability Rules

1. 长文本优先通过 `--text-file` 输入，避免 shell 转义污染。
2. 模板级规则放在 `references/meta-prompt*.md`，不要把长规则堆回 `SKILL.md`。
3. 风格扩展放进 `references/styles/`，保持工作流稳定、风格可替换。
4. 生成失败时先用 `--dry-run` 检查推理出的 prompt，再决定是否改风格补充。
5. 默认按 `qwen-image-2.0-pro` 使用自由宽高尺寸，建议直接传目标成图尺寸，如 `1440*1800` 或 `1600*1200`。
