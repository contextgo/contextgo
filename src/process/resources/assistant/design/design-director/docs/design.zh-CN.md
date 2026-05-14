# Design Director 预置助手设计稿

这份文档记录内置 `Design Director` assistant preset 的第一版吸收设计。

目标不是做一个只会说“更高级一点”“更像某某品牌”的空壳设计助手，而是把 `awesome-design-md` / `getdesign` 里最有价值的部分吸收成 ContextGo 自己的一方设计方向工作流。

## 已真实下载并阅读的参考

### 1. `VoltAgent/awesome-design-md`

- 本地仓库：`/Users/bytedance/contextgo/awesome-design-md`
- Commit：`62437487397768c31f665de7e3a108956a25f381`
- License：MIT

本轮实际阅读的正文：

- `README.md`

### 2. `getdesign` CLI 拉取的 DESIGN.md 样本

本轮实际通过 CLI 拉取并阅读：

- `/Users/bytedance/contextgo/agent-repo/design-md-samples/figma/DESIGN.md`
- `/Users/bytedance/contextgo/agent-repo/design-md-samples/vercel/DESIGN.md`
- `/Users/bytedance/contextgo/agent-repo/design-md-samples/notion/DESIGN.md`

这些正文不是仓库里的 README 占位，而是 `npx getdesign@latest add <brand>` 实际拉下来的设计系统文本。

## 为什么它应该成为一个独立内置 preset

`PM Workbench` 负责需求、策略、PRD 和路线图。

`Morph PPT` 负责演示文稿和动态叙事。

但目前还没有一个内置助手，专门处理下面这些高频设计方向问题：

- 这个产品到底应该走哪种视觉 archetype
- 参考某个品牌时，真正该吸收的是哪些设计规律
- 如何把这些规律蒸馏成项目自己的 `DESIGN.md`
- landing page 和 product surface 应该如何分别做 art direction
- 现有 UI 的问题到底是审美问题，还是系统层级与一致性问题
- 怎样把设计结论交付给前端，而不是停留在形容词

这意味着现在的设计类需求会分散到：

- 前端实现提示词
- 临时口头审美建议
- 零散页面修改

它们缺少一个统一的“设计判断层”。

一句话：

- `Design Director` 负责视觉方向、设计系统蒸馏、页面 art direction 和 UI critique
- 前端 agent 负责把这些设计结论真正实现出来

## 蒸馏边界

这个 preset 应该吸收的是 **视觉系统方法**，不是第三方品牌外壳。

### 保留什么

- `DESIGN.md` 这种适合 agent 读取的设计系统表达方式
- 把设计拆成 atmosphere、palette、type、components、layout、motion、do/don'ts 的写法
- 不同产品面对应不同 page lens 的思路
- 对品牌风格做视觉原型化，而不是“像某家网站”的一句话模仿
- 把设计意见写成实现可执行说明的交付意识

### 不直接引入什么

- 第三方品牌名作为 ContextGo 的预置助手名称
- 把某一家风格原文整包塞进 skill
- 依赖外部站点在线读取才能完成的核心流程
- 把设计工作简化成“输出一段生图 prompt”

### ContextGo 内化方式

这个 preset 应该被映射成 ContextGo 原生构件：

- 教模型做设计判断的 assistant rules
- 一套一方蒸馏的 design workflow skills
- 一组设计任务对应的 workspace commands
- 把 linked workspace 作为 `DESIGN.md`、art direction brief、critique note 和 handoff 的默认落点

## 建议的 preset 身份定义

### Assistant id

- `builtin-design-director`

### 展示名称

- `Design Director`

### 推荐领域

- `Design Direction`

### 定位

一个围绕已关联 workspace 展开的内置设计方向助手，专注于视觉 archetype 选择、项目级 DESIGN.md 蒸馏、页面 art direction、UI critique 和实现交付。

## 为什么这轮参考足够有价值

拉到的三个 DESIGN.md 样本已经体现出非常清晰的设计原型差异：

### `figma`

- 强调多彩创意内容 + 黑白界面骨架
- 对 typography、pill geometry、focus pattern 有很强个性
- 适合抽象成 `vibrant-tooling` archetype

### `vercel`

- 强调压缩感极强的黑白精度、developer infrastructure 气质和 shadow-as-border 体系
- 适合抽象成 `precision-mono` archetype

### `notion`

- 强调 warm minimalism、内容友好、柔和表面和编辑器式克制
- 适合抽象成 `warm-editorial` archetype

它们共同证明，这个来源最适合做的是：

- 风格原型选择
- 设计系统蒸馏
- 页面级 art direction

而不是做成第三方品牌复制器。

## 建议的一方蒸馏技能包

建议的技能包名称：

- `design-director-pack`

### 核心 skills

1. `design-style-archetype-selection`

- 根据产品类型、用户心智、品牌气质和信任要求，选择最合适的视觉 archetype。
- 默认 archetype 先做三类：
  - `precision-mono`
  - `warm-editorial`
  - `vibrant-tooling`

2. `design-system-distillation`

- 把产品目标、品牌语气和参考风格蒸馏成项目级 `DESIGN.md` 或 design brief。
- 输出必须覆盖 atmosphere、palette、type、components、layout、motion、do/don'ts。

3. `design-landing-page-art-direction`

- 面向营销页、官网页、活动页和产品介绍页。
- 重点处理 hero、叙事节奏、CTA、模块组合、视觉呼吸感和动效策略。

4. `design-product-surface-art-direction`

- 面向 dashboard、workspace、列表页、表单页、设置页和 operator surface。
- 重点处理信息密度、导航结构、组件等级、空态、反馈态和高频任务路径。

5. `design-ui-critique-and-polish`

- 对现有 UI 进行批判式评审。
- 找的不是“像不像参考站”，而是层级、节奏、色彩、组件一致性、交互和可实现性的问题。

6. `design-screenshot-critique`

- 面向截图、录屏定格帧和 mockup 的评审。
- 重点先看 first-scan、层级、密度、动作优先级和最值得优先改的系统问题。

7. `design-figma-reference-absorption`

- 当用户明确说要参考 Figma 时，先提炼真正该吸收的系统信号，而不是复制外壳。
- 把 monochrome chrome、expressive content、微妙字重层级、几何语言和 focus 语言翻译成产品自己的规则。

8. `design-system-adaptation`

- 当项目已有现成 design system 时，把外部参考风格翻译成可以兼容现有 token / components 的方案。
- 明确什么必须保留，什么允许变化。

9. `design-component-visual-spec`

- 当页面方向已经确定，但前端还缺组件级规则时使用。
- 把按钮、tab、card、table、input、dialog、panel 写成 anatomy、variant、state、composition 和 acceptance checks 清晰的规范。

10. `design-handoff-brief`

- 把风格方向和页面结论变成前端可执行的交付稿。
- 包含结构、token、组件、状态、响应式、motion 和 acceptance checks。

## 建议的默认启用技能

- `design-style-archetype-selection`
- `design-system-distillation`
- `design-landing-page-art-direction`
- `design-product-surface-art-direction`
- `design-ui-critique-and-polish`
- `design-screenshot-critique`
- `design-figma-reference-absorption`
- `design-system-adaptation`
- `design-component-visual-spec`
- `design-handoff-brief`

## 建议的 workspace commands

### 1. `pick-style`

使用：

- `design-style-archetype-selection`

作用：

- 在产品目标和参考风格还比较模糊时，先选出正确的视觉 archetype

### 2. `draft-design-system`

使用：

- `design-style-archetype-selection`
- `design-system-distillation`

作用：

- 生成项目级 `DESIGN.md` 或 design brief

### 3. `art-direct-page`

使用：

- `design-system-distillation`
- `design-landing-page-art-direction` 或 `design-product-surface-art-direction`

作用：

- 为当前页面输出清晰的 art direction，而不是泛泛视觉建议

### 4. `critique-ui`

使用：

- `design-ui-critique-and-polish`
- `design-system-adaptation`

作用：

- 系统化指出当前 UI 的主要问题和最优先的修正方向

### 5. `review-screenshot`

使用：

- `design-screenshot-critique`
- `design-ui-critique-and-polish`

作用：

- 先用 first-scan 读图，再指出截图里最严重的问题和最值得优先改的动作

### 6. `absorb-figma-reference`

使用：

- `design-figma-reference-absorption`
- `design-system-adaptation`
- `design-system-distillation`

作用：

- 把真正值得借鉴的 Figma 信号翻译成项目自己的设计规则，而不是做一层品牌皮

### 7. `adapt-system`

使用：

- `design-system-adaptation`
- `design-system-distillation`

作用：

- 把外部参考风格翻译进现有设计系统，而不是暴力覆盖

### 8. `spec-component`

使用：

- `design-component-visual-spec`
- `design-handoff-brief`

作用：

- 把页面级方向继续压到组件级规则，补齐 anatomy、state、composition 和 acceptance checks

### 9. `write-handoff`

使用：

- `design-handoff-brief`

作用：

- 输出前端实现可以直接跟进的设计交付稿

## 与现有产品面的关系

这个 preset 不替代前端开发，也不替代图片生成能力。

### 与前端实现的关系

- `Design Director` 负责判断“该怎么设计”
- 前端 agent 负责判断“该怎么实现”

### 与 `infographic-image` 的关系

- `infographic-image` 更偏“把内容转成视觉图像”
- `Design Director` 更偏“给产品界面和页面建立视觉系统”

### 与 `Morph PPT` 的关系

- `Morph PPT` 负责演示文稿
- `Design Director` 负责产品 UI 与页面风格

## 建议的第一版落地范围

第一版不引入：

- Figma connector
- 截图自动批注
- 额外 hooks / timers / connectors

第一版先完成：

1. built-in preset shell
2. 一方 distilled skill 包
3. 对应 workspace commands
4. assistant rules
5. third-party notices

做到这一步，`Design Director` 就已经是一个真正可用的设计方向助手，而不是一个只会说品牌名和形容词的壳。
