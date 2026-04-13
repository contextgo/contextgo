# Finance Analyst 预置助手设计稿

这份文档记录未来内置 `Finance Analyst` assistant preset 的第一版吸收设计。

目标不是把上游大包原样搬进来，而是把其中最强的方法论蒸馏成 ContextGo 自己的一方预置助手，并且能和当前已经具备的 workspace、Office 文件处理和 SQL 式分析能力顺滑协同。

## 已真实下载并阅读的上游参考

### 1. `alirezarezvani/claude-skills`

- 本地仓库：`/Users/bytedance/contextgo/agent-repo/claude-skills`
- Commit：`ea9a8759f2d55d910400691b33bb398c937ad787`
- License：MIT

本轮实际阅读的 finance 正文：

- `finance/SKILL.md`
- `finance/financial-analyst/SKILL.md`
- `finance/financial-analyst/references/valuation-methodology.md`
- `finance/financial-analyst/references/financial-ratios-guide.md`
- `finance/saas-metrics-coach/SKILL.md`

### 2. `openclaw/skills`

- 本地稀疏克隆：`/Users/bytedance/contextgo/agent-repo/openclaw-skills`
- Commit：`7da5a88549dc64c7fbbe367393203e92231f5d85`
- License：MIT

本轮实际阅读的估值正文：

- `skills/ndtchan/equity-valuation-framework/SKILL.md`

## 为什么它应该成为一个独立内置 preset

`Office Analyst` 已经覆盖了：

- 表格和文档处理
- 文件提取
- 多文件 SQL 式查询
- 多源核对
- 成品办公汇报

这些能力对金融分析是必要的，但还不够。

`Finance Analyst` 应该站在 `Office Analyst` 之上，补上真正的财务判断层：

- 财务报表联动解读
- 比率分析与 benchmark 判断
- 预算/实际偏差诊断
- DCF 与估值三角校验
- 预测与情景分析
- SaaS 指标与 unit economics 分析
- 投资 memo / 管理层财务摘要的输出纪律

一句话：

- `Office Analyst` 是文件与分析底座
- `Finance Analyst` 是财务判断与决策表达层

## 蒸馏边界

这个 preset 应该吸收方法，不应该整包照搬。

### 保留什么

- 比率分析结构
- DCF 工作流与 sanity check
- 预算偏差分析框架
- forecast / scenario 的展开方式
- SaaS 指标 benchmark 思路
- 数据质量与置信度门槛
- 估值报告的结构化输出标准

### 不直接引入什么

- 上游 Python 脚本原封不动导入
- 上游整套模板和资产包
- 带强区域假设的市场数据获取链路，例如某个地区证券数据工作流
- 超出教育分析边界的投资建议表达

### ContextGo 内化方式

这个 preset 应该优先复用现有能力：

- `xlsx`、`docx`、`pdf`
- `office-duckdb-read-file`
- `office-duckdb-query`
- `office-source-reconciliation`
- workspace commands

## 建议的 preset 身份定义

### Assistant id

- `builtin-finance-analyst`

### 展示名称

- `Finance Analyst`

### 推荐领域

- `Finance & Planning`

### 定位

一个围绕已关联 workspace 展开的内置财务分析助手，专注于财务报表、预算偏差、估值建模、滚动预测、SaaS 指标和高层财务汇报。

## 建议的一方蒸馏技能包

建议的技能包名称：

- `finance-analyst-pack`

### v1 核心 skills

1. `finance-financial-statement-analysis`

- 把利润表、资产负债表、现金流量表和 ratio 上下文放在一起分析。
- 重点是趋势、盈利质量、杠杆、流动性和营运资本。

2. `finance-ratio-benchmarking`

- 负责计算并解释比率组。
- 能按公司类型选择 benchmark，并指出分母、会计口径或一次性项目的陷阱。

3. `finance-budget-variance-analysis`

- 负责解释 actual vs budget vs prior period 的差异。
- 强调 materiality threshold、利好/不利分类和 driver 定位。

4. `finance-dcf-valuation`

- 形成 ContextGo 自己的一版 DCF 工作流。
- 强制要求 assumptions、scenario range、sensitivity grid 和与 multiples 的 sanity check。

5. `finance-forecast-scenario-planning`

- 输出 rolling forecast 和 base/bull/bear 场景。
- 把假设变化摊开，不允许藏在黑盒表格里。

6. `finance-saas-metrics`

- 覆盖 ARR、MRR growth、churn、CAC、LTV、CAC payback、NRR、quick ratio、unit economics。
- 采用与公司阶段和细分市场匹配的 benchmark，而不是一刀切阈值。

### v1.5 很值得追加的两个 skill

7. `finance-comparable-valuation`

- 做 peer multiples 和公司历史区间的相对估值。

8. `finance-investment-memo`

- 把财务分析整理成投资 memo 或管理层简报，包含 thesis、risks、confidence 和 data gaps。

## 建议的默认启用技能

这个 preset 大概率应该默认启用：

- `xlsx`
- `docx`
- `pdf`
- `office-duckdb-read-file`
- `office-duckdb-query`
- `office-source-reconciliation`
- `finance-financial-statement-analysis`
- `finance-ratio-benchmarking`
- `finance-budget-variance-analysis`
- `finance-dcf-valuation`
- `finance-forecast-scenario-planning`
- `finance-saas-metrics`
- `finance-investment-memo`

## 建议的 workspace commands

这些命令应该一看就是“财务工作流”，而不是泛办公命令。

### 1. `analyze-financials`

使用：

- `finance-financial-statement-analysis`
- `finance-ratio-benchmarking`
- `office-duckdb-read-file`
- `xlsx`

作用：

- 检查承载财务报表的工作簿或导出文件
- 总结健康度、趋势和风险
- 找出下一步需要深挖的点

### 2. `explain-variance`

使用：

- `finance-budget-variance-analysis`
- `office-duckdb-query`
- `office-source-reconciliation`

作用：

- 从 budget vs actual 或 prior-period 变化出发
- 找出 material drivers
- 解释到底哪里动了、为什么动，以及结论的把握度有多高

### 3. `build-dcf`

使用：

- `finance-dcf-valuation`
- `finance-comparable-valuation`
- `office-duckdb-query`

作用：

- 把已有财务输入变成一版决策级估值区间
- 自动带出 sensitivity 和 assumptions disclosure

### 4. `forecast-business`

使用：

- `finance-forecast-scenario-planning`
- `office-duckdb-query`
- `xlsx`

作用：

- 形成 base/bull/bear forecast
- 把经营驱动和假设变化显式展开

### 5. `benchmark-saas`

使用：

- `finance-saas-metrics`
- `office-duckdb-query`

作用：

- 把原始 SaaS 经营数字转成 health report
- 按 segment 和 stage 做 benchmark
- 排出最优先要修的指标

### 6. `write-investment-memo`

使用：

- `finance-investment-memo`
- `finance-dcf-valuation`
- `finance-ratio-benchmarking`
- `docx`

作用：

- 生成带 thesis、valuation、risks、confidence 和 explicit gaps 的结构化 memo 或管理简报

## 这个 preset 应该保持的行为风格

它应该始终做到：

- 把“已披露事实”和“推断假设”分开
- 把“精确估值”和“方向性估值”分开
- 输入不完整或过旧时主动降级 confidence
- 不把单点估值伪装成确定答案
- 把分析翻译成能支持决策的语言，而不是只输出表格数字

## 必须保留的输出标准

从这轮上游参考里，最值得吸收到 ContextGo 自己报告规范里的，是这些东西：

- confidence tiers
- 数据质量 gate
- scenario-based valuation / forecast
- sensitivity analysis
- business quality checklist
- risk register
- margin-of-safety framing

这些应该最终变成 ContextGo 的金融分析输出标准。

## 建议的工程落点

### Preset 表面层

- assistant rules 放在 `src/process/resources/assistant/finance/finance-analyst/`
- packaged skills 放在 `src/process/resources/skills/finance-analyst-pack/`
- workspace commands 放在 `workspaceAutomation.ts`
- preset 注册放在 `assistantPresets.ts`

### 建议的实现顺序

1. 先补 built-in preset shell 和 workspace commands。
2. 先写 4 到 6 个核心 first-party skills。
3. 直接复用 `Office Analyst` 的文件查询与 DuckDB 底座，不重新造第二套数据接入层。
4. 为 MIT 来源补一份 `THIRD_PARTY_NOTICES.md`。
5. 等 v1 稳定以后，再考虑银行、制造、并购等行业 pack。

## v1 明确不做什么

- 实时行情抓取
- 券商或组合执行
- 个性化投资建议
- 各国税务或金融监管合规流程
- 银行、保险、困境资产等高度专业的行业特化

## 推荐的第一版实现切片

如果下一步要正式实现，这个 preset 最小但足够成立的 v1 应该是：

- preset shell
- 6 个核心 skills
- 6 个 finance commands
- 暂时不引入上游大脚本
- 依靠 first-party distilled prompts 加现有 office / DuckDB 能力落地

做到这一步，就足以证明 `Finance Analyst` 是一个真正成立的产品面，而不是给 `Office Analyst` 换一层财务词汇外壳。
