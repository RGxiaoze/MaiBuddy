# 舞萌DX 伴侣 - 项目规范

## 文档索引

| 文档 | 路径 | 用途 |
|------|------|------|
| 需求规格 | [docs/01-需求规格.md](docs/01-需求规格.md) | 用户故事、功能范围、非功能需求 |
| 技术选型 | [docs/02-技术选型.md](docs/02-技术选型.md) | 技术栈选择与理由、API 端点 |
| 设计规范 | [docs/03-设计规范.md](docs/03-设计规范.md) | 色彩、排版、布局、组件规范 |
| 执行步骤 | [docs/04-执行步骤.md](docs/04-执行步骤.md) | 四个阶段的具体实施步骤 |
| 算法详解 | [docs/05-算法详解.md](docs/05-算法详解.md) | Rating/B50/五维算法、完整系数表 |
| 算法说明 | [docs/algorithms.md](docs/algorithms.md) | 玩家友好算法解读（不含代码） |
| 知识库 | [docs/knowledge-base.md](docs/knowledge-base.md) | 定数阶梯策略、成就牌子文案 |
| 开发日志 | [开发日志/](开发日志/) | 每日开发记录（按日期命名） |

## AI 工作指引

### 每次对话开始时
1. 浏览 `开发日志/` 文件夹，了解项目进展
2. 参考 [docs/04-执行步骤.md](docs/04-执行步骤.md)，确认当前阶段和下一步
3. 编写 UI 代码前查阅 [docs/03-设计规范.md](docs/03-设计规范.md)

### 每次对话结束时
1. 在 `开发日志/YYYY-MM-DD.md` 中记录完成事项、待办事项、修改文件清单
2. 若完成步骤，在 [docs/04-执行步骤.md](docs/04-执行步骤.md) 中勾选对应 checkbox

### 门禁路径

本项目为**小型个人项目**，门禁走全局 CLAUDE.md 中定义的 **waza-think 路径**（brainstorming 不自动触发）。

### TDD 策略

本项目已启用 `superpowers-test-driven-development`。遵循全局 CLAUDE.md 中的「TDD 策略」——新功能/修复需写测试，算法/工具函数强制，UI/样式/配置可豁免。

### 开发原则
- 每次完成 1-2 个步骤，确认无误后再继续
- 做任何更改前，参考对应的 docs 文件
- 遵循全局 CLAUDE.md 中的行为准则（think before coding、simplicity first、surgical changes）
- TDD：修改纯逻辑代码前先写失败测试；修改 UI/样式时不强制

### 手动调试交接原则

浏览器自动化不可用（无 Chrome/Chromium）时，代码修改完成后必须：

1. **列出需手动验证的检查点**：明确告知开发者哪些页面 / 组件 / 交互需要打开浏览器确认
2. **说明预期行为**：每个检查点描述正确表现（如「切换难度后卡片应显示三行对比」）
3. **标注风险区域**：指出改动可能影响的相关功能（如「loadStats 签名变更可能影响 DimensionAnalysis 和 PushSuggestions」）
4. **格式示例**：

```
## 手动验证清单

| # | 页面 | 操作 | 预期结果 |
|---|------|------|----------|
| 1 | 曲目详情页 | 打开「系ぎて」Re:MASTER | 全服达成分布显示三行对比 |
| 2 | 曲目详情页 | 切换不同难度 | 三行数据随难度正确更新 |
| 3 | 五维分析页 | 刷新页面 | 页面正常加载，无白屏 |
```

此清单在每次代码修改后、提交 Git 之前产出。

## 技术栈

React + TypeScript + Vite + TailwindCSS v4 + Zustand + Dexie(IndexedDB) + ECharts

详细选型理由与 API 端点见 [docs/02-技术选型.md](docs/02-技术选型.md)。

## 核心算法

见 [docs/05-算法详解.md](docs/05-算法详解.md)。

- **Rating**: `floor(谱面定数 × 等级系数 × 达成率)`，24 阈值分段函数
- **B50**: `Best35(旧版本) + Best15(新版本)`，按 Rating 降序，宴会场排除
- **DX 星数**: `DX分数率 = dxScore ÷ (总物量×3)`，97/95/93/90/85% 五档阈值 → ⭐1-5
- **五维**: 底力/体力/爆发/定位/技巧，平方加权平均，≥97% 成绩参与

## 开发阶段

- **阶段一** (已完成): 基础架构 — 项目初始化、曲目检索、详情页、手动成绩录入
- **阶段二** (已完成): 数据联网 — API 对接、B50 算法、五维雏形、曲目缓存、全量成绩导入
- **v0.3.0** (已完成): 结构性调整 — 多关键词搜索、别名、定数预设、分页、导入迁移、侧边栏卡
- **阶段三** (已完成): 推分建议 — 推分算法、chart_stats 集成、知识库、策略分段、五维雷达图、推分路线
- **v0.4.0** (已完成): 算法重构 — 配置提取、文件拆分、JSDoc、测试完善、全服达成分布卡片优化、项目结构清理
- **阶段四** (待定): 五维算法优化 — 统计指标 → 定数分组五维 → 公式修复 → 双环雷达图

## 未来计划

- **日服数据**：`VERSION_REGIONS['日服']` 框架已预留，待 LXNS API 集成后启用
- **别名自动更新**：当前手动触发获取，未来可加定时刷新
- **搜索语法增强**：`artist:jack` 前缀语法、`|` OR 逻辑、`-` 排除逻辑
- **DX 分数纳入五维**：将 DX 分数率作为判定精度补充指标融入五维分析
- **保护套算法**：深入研究 EX-TAP/EX-HOLD 对谱面难度评估的影响

## 已知陷阱

- **yuzuchan.moe 别名 API 响应格式**：接口返回 `{code: 0, content: AliasEntry[]}` 对象而非裸数组。解析时需先提取 `content` 字段：`const data = Array.isArray(raw) ? raw : raw.content`。仅检查 `Array.isArray()` 将静默失败——别名索引永远为 null，所有别名搜索返回 0 结果。
- **Diving-Fish chart_stats 数据类型**：`ChartStatEntry.diff` 为 `string` 类型（如 `"14+"`、`"12"`），非 `number`。`buildChartStats()` 中构建 `diff_data` 索引时需使用 `entry.diff`（字符串 key），而非 `Math.floor(entry.fit_diff)`（数值 key）。类型声明错误将导致所有谱面的全服统计数据查找失败。`fit_diff` 是社区拟合的实际定数（`number`），与官标 `diff` 是不同字段。

## UI 规范

- 浅色主题：白色背景 + 淡蓝(#5BA4CF) + 淡紫(#B8A0E8) + 深紫(#6C4DBF)装饰
- 字体：M PLUS Rounded 1c(标题) + Inter/Noto Sans SC(正文)
- SVG 图标(Lucide)，不使用 emoji
- 响应式布局：桌面可折叠侧边栏 + 移动端底部导航
- 详细配色与组件规范见 [docs/03-设计规范.md](docs/03-设计规范.md)

## Git 工作流约定

- 当我要求"保存进度"或"完成了一个功能"时，你应该主动询问是否需要提交 Git。
- 提交信息格式：`<type>: <description>`，type 可选 `feat` / `fix` / `docs` / `refactor`。
- 不要自动 push，需要我明确说"推送"才执行。
- 任何破坏性操作（`git reset`、`git push --force` 等）必须先征得同意。
