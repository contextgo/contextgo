# Marketing Creative Studio 预设设计

本文档记录内置 `Marketing Creative Studio` 助手预设的设计取舍。

目标不是再做一个泛用的设计助手，而是让 ContextGo 的营销视觉工作流在品牌、增长、电商、售前等场景下保持稳定、可追溯、品牌一致。

## 为什么需要单独的内置 Package

当前 ContextGo 已经具备视觉相关内置能力：

- `Design Director` 负责产品 UI 方向、视觉 archetype 选择、截图评审、设计系统蒸馏与前端 handoff
- `Morph PPT` 负责演示文稿、叙事 deck 和动画故事流

但实际业务里有几类高频任务并不属于产品 UI 设计，也不属于 deck 输出：

- 多网络多尺寸的广告创意
- 多平台多语言的社交内容批量包
- 电商卖点图、banner、活动 KV
- 售前一页纸、概览页与视觉物料
- 同一份 brief 派生出的多变体素材集

如果没有专门的 package，这类工作会散落到：

- 临时性的图像生成 prompt
- 不一致的品牌调性与视觉语言
- 容易踩平台规格的素材
- 从 brief 到最终素材完全没有追溯链路

`Marketing Creative Studio` 把这一层作为 first-party、ContextGo-native 的能力沉淀进来。

## 分层模型

包内能力按稳定的分层组织：

1. **Brand Context** - 标准化的品牌身份、调性、禁用词、渠道偏好与视觉基本单元。
2. **Channel Constraints** - 目标平台规格、宽高比、文案长度限制、合规占位。
3. **Visual Recipe** - 真正的素材族：广告创意、社交素材、电商画面、KV、一页纸。
4. **Variant Set** - 按受众、语言、阶段或渠道派生的多变体输出。
5. **Trace Metadata** - brief id、主题 id、渠道、版本、来源。

每个生成流程都要按顺序走完这 5 层，跳过任何一层都是缺陷而不是捷径。

## 与 Design Director 的边界

| 关注点                    | Marketing Creative Studio | Design Director |
| ------------------------- | ------------------------- | --------------- |
| 多渠道广告创意            | 本包                      | 不在范围        |
| 社媒内容批量包            | 本包                      | 不在范围        |
| 电商 KV / banner / 卖点图 | 本包                      | 不在范围        |
| 售前一页纸 / 概览视觉     | 本包                      | 不在范围        |
| 产品 UI 设计方向          | 回切                      | 本包            |
| 截图评审                  | 回切                      | 本包            |
| 设计系统蒸馏              | 回切                      | 本包            |
| 前端实现 handoff          | 回切                      | 本包            |
| 营销表面的品牌身份归一化  | 本包                      | 在产品表面共有  |

如果一个请求同时涉及产品 UI 设计与营销视觉物料，应当把产品 UI 部分明确路由回 Design Director，不要混做。

## 与 Morph PPT 的边界

`Morph PPT` 负责叙事型 deck、Morph 动画规划与 PPTX 输出。它拥有长篇故事结构、动画规划与 deck 构建。

`Marketing Creative Studio` 不负责 deck 叙事。当一个 campaign 同时需要 deck（销售支持、投资人叙事、产品发布故事）时，应把 deck 部分路由给 Morph PPT，本包继续负责静态视觉物料族。

## 分期

Phase 1（首版内置范围）：

- brand context 归一化
- ad creative builder 与 social asset batch，含基础平台规格检查
- visual-copy pairing
- 工作空间命令种子：brief、theme、ad creative、social batch、variant set

Phase 2：

- 扩展行业 recipe（电商、SaaS、咨询售前、活动传播）
- 更完整的 brand theme pack 与可复用素材模板

Phase 3：

- 周期性 campaign 刷新与跨渠道一致性审计
- 当源 brief 变化时跟踪并标记过期素材

包结构、manifest、skill 集应在不同阶段保持稳定，后续阶段以增量方式扩展。
