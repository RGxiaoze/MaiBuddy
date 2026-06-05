# PROJECT STATUS — 舞萌DX 伴侣 (maimai DX Companion)

> **生成日期**: 2026-06-05 | **当前版本**: v0.4.0
>
> 本文档用于新 AI Agent 快速理解项目全貌，从零到可继续开发。

---

## 1. 项目概述

**名称**: 舞萌DX 伴侣 (maimai DX Companion)

**目标**: 浏览器端舞萌DX辅助工具，支持曲目检索、成绩管理、B50 分析和五维能力评估，**全功能离线可用**。

**技术栈**:

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 19.2 |
| 语言 | TypeScript | 6.0 |
| 构建 | Vite | 8.0 |
| 样式 | TailwindCSS | v4 |
| 状态管理 | Zustand | 5.0 |
| 本地存储 | Dexie.js (IndexedDB) | 4.4 |
| 图表 | ECharts + echarts-for-react | 6.1 / 3.0 |
| 路由 | react-router | 7.16 |
| 图标 | lucide-react | 1.17 |
| 测试 | vitest | 4.1 |

**项目性质**: 小型个人项目，纯前端（无后端服务器），SPA 架构，数据通过外部社区 API + IndexedDB 本地存储。

---

## 2. 已实现功能（按阶段）

### 阶段一：基础架构（已完成 ✅）

- 项目初始化（Vite + React + TS + TailwindCSS v4）
- 完整目录骨架 + TypeScript 类型定义（Song / Chart / Score / API 响应等）
- Diving-Fish API 服务层 + IndexedDB 数据库（Dexie，含 v1→v4 迁移）
- Zustand 三 Store（songStore / scoreStore / playerStore）
- React Router 路由（`/songs` / `/songs/:id` / `/player` / `/analysis`）
- MainLayout 响应式布局（桌面侧边栏 + 移动端底部导航）
- 曲目检索页：多关键词 AND 搜索、高级筛选（定数/版本/难度）、50条/页分页
- 曲目详情页：谱面信息、DX Rating 对照表、成绩录入/编辑/删除
- 成绩录入表单：模态框、字段校验、IndexedDB 写入
- 共享组件库：LoadingSpinner / ErrorMessage / EmptyState / DifficultyBadge / GradeBadge / InfoTooltip 等

### 阶段二：数据联网与统计（已完成 ✅）

- **Rating 计算**: `computeRating()` 基于 24 段 COEFFICIENT_TABLE 的分段函数
- **B50 算法**: `computeB50()` — Best35（旧版本）+ Best15（新版本），宴会场排除
- **曲目 IndexedDB 缓存**: songCache 表，24h TTL，缓存优先 + 后台刷新
- **Diving-Fish 在线查分**: POST `/query/player`，B50 列表 + 总 Rating
- **完整成绩导入**: `/player/records` 接口，支持用户名+密码自动获取 Import-Token，Token localStorage 持久化，按 `[songId+levelIndex]` 去重保留最高分
- **玩家信息页**: 在线/本地 B50 双 Tab 切换
- **五维分析雏形**: 底力/体力/爆发/定位/技巧，平方加权平均

### v0.3.0：结构性调整（已完成 ✅）

- 多关键词 AND 搜索（空格分词，匹配 title/artist/noteDesigner/aliases）
- 别名搜索（Yuri-YuzuChaN 社区别名 API → 反向索引 → 子串匹配）
- 定数预设按钮（13/13+/14/14+/15，.0-.5/.6-.9 分段）
- 版本按国服筛选（日服框架预留）
- 侧边栏用户信息卡片
- 导入按钮迁移到曲目查询页
- DX 星数评分展示（五星制，97/95/93/90/85% 五档阈值）
- 6 项展示修复 + 别名 API Bug 修复（已知陷阱见第 6 节）

### 阶段三：推分建议（已完成 ✅）

- **推分建议核心算法**: 定数众数伸展区定位、地板替换逻辑、动态合理目标达成率、SSS+ 率加权排序
- **推分建议 UI**: PushSuggestions 面板组件，前 5 条展示 + 展开全部
- **五维分析页面整合**: ECharts 雷达图 + 短板诊断 + 递进练习推荐
- **推分路线**: 4 阶段定数区间规划（低/中/高/超高），全服数据驱动
- **策略分段**: 9 档定数阶梯（入门→铜框→金框→白金框→冲击万六→万六→14+攻克→冲击理论→理论Rating），每档独立 Action Items + 文案
- **理论最高 Rating**: 遍历曲库计算 B35/B15 理论天花板，AP 查漏

### v0.4.0：算法重构 + 全服达成分布卡片（已完成 ✅）

- 配置提取：`src/config/algorithms.ts`（60+ 业务常量集中管理，中文注释）
- 文件拆分：`rating.ts`(449 行) → `rating.ts`(42) + `b50.ts` + `pushSuggestions.ts` + `difficultyTier.ts`
- 全部导出函数 JSDoc 注释
- 测试完善：65 用例（5 个测试文件，vitest 全部通过）
- 全服达成分布卡片优化：显示差值而非绝对值、混合统计（同官标+同定数兜底）、灰化边界、fit_diff 显示、标准差分级
- 项目结构清理：删除调试截图/参考项目、卸载未用依赖、文件位置统一

---

## 3. 目录结构

```
maimai-companion/
├── src/                            # 源代码
│   ├── main.tsx                    # Vite 入口
│   ├── App.tsx                     # React Router 配置 + lazy 路由
│   ├── App.css / index.css         # 全局样式 / TailwindCSS
│   ├── components/
│   │   ├── layout/                 # 布局组件
│   │   │   ├── MainLayout.tsx      # 桌面侧边栏 + Outlet
│   │   │   ├── Sidebar.tsx         # 左侧导航栏
│   │   │   ├── MobileBottomNav.tsx # 移动端底部导航
│   │   │   ├── MobileHeader.tsx    # 移动端顶部标题栏
│   │   │   └── UserInfoCard.tsx    # 侧边栏用户信息卡片
│   │   ├── shared/                 # 共享 UI 组件
│   │   │   ├── SearchBar.tsx       # 搜索栏
│   │   │   ├── ScoreForm.tsx       # 成绩录入/编辑表单
│   │   │   ├── PushSuggestions.tsx # 推分建议面板
│   │   │   ├── Pagination.tsx      # 分页导航
│   │   │   ├── DifficultyBadge.tsx # 难度标签
│   │   │   ├── GradeBadge.tsx      # 评级标签
│   │   │   ├── InfoTooltip.tsx     # hover 弹出解释
│   │   │   ├── LoadingSpinner.tsx  # 加载指示器
│   │   │   ├── ErrorMessage.tsx    # 错误提示
│   │   │   ├── EmptyState.tsx      # 空状态占位
│   │   │   └── ErrorBoundary.tsx   # React 错误边界
│   │   └── charts/
│   │       └── RadarChart.tsx      # ECharts 五维雷达图
│   ├── pages/                      # 页面组件（lazy loaded）
│   │   ├── SongList.tsx            # 曲目检索页
│   │   ├── SongDetail.tsx          # 曲目详情页
│   │   ├── PlayerInfo.tsx          # 玩家信息页（B50 + 推分路线）
│   │   └── DimensionAnalysis.tsx   # 五维分析页（雷达图 + 短板 + 练习推荐）
│   ├── services/                   # API 服务层
│   │   ├── divingFishApi.ts        # Diving-Fish 主 API（曲目/成绩/chart_stats）
│   │   ├── lxnsApi.ts              # LXNS API 桩代码（待实现）
│   │   ├── adapter.ts              # 数据格式转换适配器
│   │   └── statsService.ts         # chart_stats 缓存 + 预计算 + 查询
│   ├── db/
│   │   └── database.ts             # Dexie 数据库定义 + CRUD 方法（4 表/4 版本迁移）
│   ├── store/                      # Zustand 状态管理
│   │   ├── songStore.ts            # 曲目列表 + 搜索 + 筛选 + 缓存
│   │   ├── scoreStore.ts           # 成绩 CRUD + IndexedDB 同步
│   │   └── playerStore.ts          # Diving-Fish 查分 + 本地 B50
│   ├── utils/                      # 算法 & 工具函数
│   │   ├── rating.ts               # 单曲 Rating 计算
│   │   ├── b50.ts                  # B50 组合算法 + 理论最高 Rating
│   │   ├── pushSuggestions.ts      # 推分建议生成
│   │   ├── difficultyTier.ts       # 推分难度分类 + 合理目标达成率
│   │   ├── dimensions.ts           # 五维计算（谱面 + 玩家）
│   │   ├── chartTags.ts            # 谱面标签分类（7 种）
│   │   ├── dxStar.ts               # DX 星数评分
│   │   ├── strategy.ts             # 9 档定数阶梯策略
│   │   ├── weaknessAnalysis.ts     # 短板诊断
│   │   ├── practiceRecommend.ts    # 递进练习推荐
│   │   ├── routePlanner.ts         # 推分路线规划
│   │   ├── knowledgeBase.ts        # 知识库加载与查询
│   │   ├── bilibiliSearch.ts       # B站手元搜索链接生成
│   │   └── __tests__/              # 单元测试
│   │       ├── rating.test.ts      # 26 用例
│   │       ├── b50.test.ts         # 9 用例
│   │       ├── dxStar.test.ts      # 9 用例
│   │       ├── difficultyTier.test.ts # 14 用例
│   │       └── chartTags.test.ts   # 7 用例
│   ├── config/
│   │   └── algorithms.ts           # 60+ 算法常量（B50结构/Rating/推分/五维/标签分类）
│   ├── data/
│   │   ├── constants.ts            # 显示常量（难度映射/评级颜色/COEFFICIENT_TABLE/封面URL）
│   │   ├── aliases.ts              # 社区别名索引（yuzuchan.moe API）
│   │   └── versions.ts             # 版本映射表
│   └── types/
│       └── index.ts                # 全部 TypeScript 类型定义（Song/Score/Player/API响应）
├── public/
│   └── data/
│       └── kb.json                 # 编译后的知识库（prebuild 生成，Git 忽略）
├── docs/                           # 项目文档
│   ├── 01-需求规格.md              # 用户故事、功能范围
│   ├── 02-技术选型.md              # 技术栈选型理由、API 端点
│   ├── 03-设计规范.md              # 色彩/排版/布局/组件规范
│   ├── 04-执行步骤.md              # 四个阶段的具体实施步骤（最详细的进度追踪）
│   ├── 05-算法详解.md              # Rating/B50/五维算法 + 完整系数表
│   ├── algorithms.md               # 玩家友好算法说明（不含代码）
│   └── knowledge-base.md           # 定数阶梯策略 + 成就牌子文案
├── scripts/
│   └── build-kb.js                 # 知识库编译脚本（Markdown → JSON）
├── 开发日志/                       # 每日开发记录（YYYY-MM-DD.md）
├── CLAUDE.md                       # AI Agent 工作指引
├── README.md                       # 项目 README
├── vite.config.ts                  # Vite 配置 + API 代理 + vitest 配置
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── eslint.config.js                # ESLint flat config
├── package.json                    # 依赖 & 脚本
└── LICENSE                         # MIT
```

### 关键文件索引

| 用途 | 文件路径 |
|------|----------|
| 路由配置 | [src/App.tsx](src/App.tsx) |
| 全局状态 | [src/store/songStore.ts](src/store/songStore.ts) / [scoreStore.ts](src/store/scoreStore.ts) / [playerStore.ts](src/store/playerStore.ts) |
| API 服务 | [src/services/divingFishApi.ts](src/services/divingFishApi.ts) |
| 数据库 | [src/db/database.ts](src/db/database.ts) |
| 类型定义 | [src/types/index.ts](src/types/index.ts) |
| 算法配置常量 | [src/config/algorithms.ts](src/config/algorithms.ts) |
| 单曲 Rating | [src/utils/rating.ts](src/utils/rating.ts) |
| B50 算法 | [src/utils/b50.ts](src/utils/b50.ts) |
| 推分建议 | [src/utils/pushSuggestions.ts](src/utils/pushSuggestions.ts) |
| 难度分类 | [src/utils/difficultyTier.ts](src/utils/difficultyTier.ts) |
| 五维分析 | [src/utils/dimensions.ts](src/utils/dimensions.ts) |
| 推分策略 | [src/utils/strategy.ts](src/utils/strategy.ts) |
| 全服统计 | [src/services/statsService.ts](src/services/statsService.ts) |
| 显示常量 | [src/data/constants.ts](src/data/constants.ts) |
| 别名数据 | [src/data/aliases.ts](src/data/aliases.ts) |
| Vite 配置 | [vite.config.ts](vite.config.ts) |

---

## 4. 核心算法

### 4.1 Rating 计算 (`src/utils/rating.ts`)

```
单曲Rating = floor(系数 × 定数 × min(达成率, 100.5%) / 100)
```

- 达成率截断至 100.5%（超出无效）
- 24 段 `COEFFICIENT_TABLE`（见 `src/data/constants.ts`）按降序查找对应系数
- 系数范围：0.0～22.4，达成率越高系数越大
- 达成率 ≤ 0 或定数 ≤ 0 时返回 0

### 4.2 B50 组合 (`src/utils/b50.ts`)

```
B50 = Best35(旧版本) + Best15(新版本)

步骤：
1. 对每个 (songId + levelIndex) 保留最高达成率
2. 跳过宴会场曲目（ID ≥ 100000）
3. 按 isNew 分成旧曲池和新曲池
4. 各池按 Rating 降序 → 定数降序 → 达成率降序排列
5. 分别取前 35 首（旧）和前 15 首（新）
6. 两池 Rating 累加 = 总 Rating
```

**关键数据字段**: `song.isNew`（来自 `basic_info.is_new`）决定曲目分入 b35 还是 b15 池。

**理论最高 Rating**: 遍历全曲库，每首取最高定数谱面，按 isNew 分池，取前 35/15 首，假设 100.5% 达成率累加。

### 4.3 五维分析 (`src/utils/dimensions.ts`)

**五个维度**:

| 维度 | 原始公式 | 归一化 |
|------|----------|--------|
| 底力 | `BPM × total_notes` | `/20000 × 10` |
| 体力 | `total_notes × estimated_length` | `/50000 × 10` |
| 爆发 | `BPM × peak_density × 1.5` | `/30000 × 10` |
| 定位 | `(TOUCH + SLIDE×1.5 + HOLD×0.8) / total` | `/0.8 × 10` |
| 技巧 | `(SLIDE×1.2 + HOLD + BREAK + TOUCH×1.1) / total` | `/0.7 × 10` |

**玩家能力聚合**: 三次加权平均 `Σ(s³ × f) / Σ(s²)`，f 为达成率因子（97%→0.6，98%→0.7，…，100.5%→1.0）。只有达成率 ≥ 97% 的成绩参与计算。

**已知限制** (待阶段四修复):
- 体力公式反直觉（同物量下低 BPM 反而分高）
- 爆发公式忽略物量（100 note 和 2000 note 同分）
- 万六和舞神用户雷达图几乎重叠

### 4.4 推分建议 (`src/utils/pushSuggestions.ts`)

```
核心逻辑：
1. 确定 B35/B15 两池的地板分（各自最底的 Rating）
2. 计算 B35 定数众数作为玩家舒适区
3. 推荐伸展区（众数 +0.1 到 +0.5）中不在 B50 的谱面
4. 已是 B50 地板曲目的谱面：若提升达成率能涨分 → 生成建议
5. 排除"随便打打"（定数<14 且达成率<97%）
6. 按加权分排序：ratingGain × (1 + sssPlusRate × 2)，优先水分曲
```

**合理目标达成率** (`realisticTargetAch()`): 根据谱面定数与玩家舒适区的差距分段：
- gap ≤ 0.3 → 100.5%（天花板）
- 0.3 < gap ≤ 0.5 → 100.0%（SSS）
- 0.5 < gap ≤ 1.0 → 99.0%（SS，B50 地板曲目的上限）
- gap > 1.0 → 98.5%（SS+，回退）

### 4.5 难度分类 (`src/utils/difficultyTier.ts`)

```
有 chart_stats 时：
1. 15 级谱面 → hard（个人差极大）
2. diffFromLevelAvg > 2.0 → easy（水分曲）
3. diffFromLevelAvg > -1.0 → medium
4. diffFromLevelAvg ≤ -1.0 → hard（硬谱）
5. SSS+ 率 > 15% 时提升一档

无 chart_stats 回退：
- 达成率 ≥ 99.5% → easy
- 达成率 ≥ 98.0% → medium
- 其余 → hard
```

### 4.6 谱面标签分类 (`src/utils/chartTags.ts`)

7 种标签，基于物量占比和 BPM 判定：交互（TAP>60% + BPM>160）、纵连（TAP>65% + BREAK>2%）、星星（SLIDE>20%）、跳拍（SLIDE<10% + BREAK>5% + BPM>150）、体力（总物量>900 + BPM>170）、技巧（TOUCH>3% 或 SLIDE>25%）、综合（不满足以上任一条件）。

### 4.7 DX 星数 (`src/utils/dxStar.ts`)

```
DX分数率 = dxScore / (总物量 × 3)
阈值: 97%/95%/93%/90%/85% → ⭐5/4/3/2/1
```

---

## 5. API 依赖

所有外部 API 通过 Vite 代理转发，源站不变，前端调用本地路径。

### Diving-Fish API（主数据源）

| 接口 | 方法 | 用途 | 调用时机 | 缓存 |
|------|------|------|----------|------|
| `/api/maimaidxprober/music_data` | GET | 曲目元数据（全量） | 首次加载 + 后台刷新 | IndexedDB songCache，24h TTL |
| `/api/maimaidxprober/query/player` | POST | 玩家 B50 成绩 | 用户手动查询 | 无（实时） |
| `/api/maimaidxprober/player/records` | GET | 完整成绩（需 Import-Token header） | 用户手动导入 | 导入后存 IndexedDB scores 表 |
| `/api/maimaidxprober/login` | POST | 登录获取 JWT Cookie | 自动获取 Token 时 | Cookie（浏览器自动管理） |
| `/api/maimaidxprober/player/import_token` | PUT | 获取/刷新 Import-Token | 登录后自动调用 | localStorage |
| `/api/maimaidxprober/chart_stats` | GET | 全服谱面统计数据 | 首次打开 SongDetail + 后台刷新 | IndexedDB statsCache，24h TTL |

### 社区别名 API（yuzuchan.moe）

| 接口 | 方法 | 用途 | 调用时机 | 缓存 |
|------|------|------|----------|------|
| `/alias-api/maimai/alias/general/list` | GET | 谱面常用别称 | App 启动时加载 | IndexedDB aliasCache，24h TTL |

### 代理配置 (`vite.config.ts`)

```javascript
proxy: {
  '/api': { target: 'https://www.diving-fish.com', changeOrigin: true, cookieDomainRewrite: 'localhost' },
  '/alias-api': { target: 'https://www.yuzuchan.moe', changeOrigin: true, rewrite: path => path.replace(/^\/alias-api/, '/api') },
}
```

### 缓存策略总结

| 数据 | 存储位置 | TTL | 刷新策略 |
|------|----------|-----|----------|
| 曲目元数据 | IndexedDB songCache | 24h | 缓存优先，后台异步刷新 |
| 社区别名 | IndexedDB aliasCache | 24h | 同上 |
| chart_stats | IndexedDB statsCache | 24h | 同上 |
| 用户成绩 | IndexedDB scores | 永久 | 手动增删改 + 全量导入 |
| Import-Token | localStorage | 无过期 | 手动刷新 |

---

## 6. 已知问题/Bug

### 已知陷阱（项目规范中明确标注）

1. **别名 API 响应格式**：yuzuchan.moe 返回 `{code: 0, content: AliasEntry[]}` 对象而非裸数组。解析时需先提取 `content` 字段。仅检查 `Array.isArray()` 会静默失败。已修复：`aliases.ts` 兼容两种格式。

2. **chart_stats 数据类型**：`ChartStatEntry.diff` 是 `string`（如 `"14+"`），非 `number`。`buildChartStats()` 中 `diff_data` 索引须用 `entry.diff` 而非 `Math.floor(entry.fit_diff)`。`fit_diff` 是社区拟合定数（`number`），与官标 `diff` 是不同字段。已修复。

3. **B50 查询需显式传 `b50: true`**：Diving-Fish `/query/player` 默认返回 B40，不加此参数仅得 40 首。已修复。

4. **不存在玩家返回 HTTP 200**：Diving-Fish 对不存在的用户返回 `{"message":"user not exists"}` 且无 `charts` 字段，需检查 `data.charts` 而非依赖 HTTP 状态码。已处理。

### 已知功能限制

5. **五维区分度不足**：体力公式反直觉、爆发公式忽略密度、万六和舞神雷达图重叠。计划在阶段四修复。

6. **短板分析无基准对比**：当前 `analyzeWeakness()` 只看自身不看同段位、未控制定数、标签粗糙、样本量小。计划在阶段四引入 chart_stats 基准。

7. **LXNS API 未实现**：`lxnsApi.ts` 仅有桩代码和类型定义，日服数据框架已预留但未集成。

---

## 7. 待开发/日后计划

### 阶段四（优先级排序）

1. **P0: 数值统计指标** — AP 计数、SSS+ 计数、Rating 进度、定数区间分布统计（不改五维算法本身，增加可量化指标）
2. **P0: 短板分析基准化** — 引入 chart_stats 基准、按定数区间分层、残差分析、统计置信
3. **P1: 定数区间分组五维** — 13.0-13.9 / 14.0-14.5 / 14.6-14.9 / 15.0+ 四组并排雷达图
4. **P1: 谱面配置解析** — 研究 Simai/.ma2 格式，逐音符解析提取扫键/圈/纵连等特征
5. **P2: 修复体力/爆发公式** — 重新校准 NORM_MAX
6. **P2: 双环雷达图** — 舒适区（内环）+ 极限区（外环）
7. **P2: 标签体系替换** — 接入谱面配置解析器，替换统计标签

### 日后计划

- **日服数据**: `VERSION_REGIONS['日服']` 框架已预留，待 LXNS API 集成
- **别名自动更新**: 当前手动触发，未来加定时刷新
- **搜索语法增强**: `artist:jack` 前缀语法、`|` OR 逻辑、`-` 排除逻辑
- **DX 分数纳入五维**: 将 DX 分数率作为判定精度补充指标
- **保护套算法**: 深入研究 EX-TAP/EX-HOLD 对谱面难度评估的影响
- **收藏品查询**: 未来可扩展功能
- **知识库扩展**: 更多策略文案和成就条件

---

## 8. 开发环境命令

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 生产构建（含知识库编译 prebuild）
npm run build

# 仅编译知识库（Markdown → public/data/kb.json）
npm run build:kb

# 运行测试
npm test               # vitest run（一次性）
npm run test:watch     # vitest（持续监听）

# 预览生产构建
npm run preview

# ESLint 检查
npm run lint
```

---

## 9. 项目配置

### TypeScript (`tsconfig.app.json`)

- target: ES2023, module: ESNext, moduleResolution: bundler
- 路径别名: `@/*` → `./src/*`
- 严格选项: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`
- 参见: [tsconfig.app.json](tsconfig.app.json) / [tsconfig.node.json](tsconfig.node.json)

### ESLint (`eslint.config.js`)

Flat config 格式，继承 `@eslint/js` + `typescript-eslint` + `react-hooks` + `react-refresh/vite`，忽略 `dist/`。

### Vite 代理 (`vite.config.ts`)

- `/api` → `https://www.diving-fish.com`（含 `cookieDomainRewrite: 'localhost'`）
- `/alias-api` → `https://www.yuzuchan.moe`（路径重写去 `/alias-api` 前缀）

### TailwindCSS v4

使用 `@tailwindcss/vite` 插件，主题变量在 `src/index.css` 中定义：
- 主色: `#5BA4CF`（淡蓝）
- 强调色: `#B8A0E8`（淡紫）/ `#6C4DBF`（深紫）
- 字体: M PLUS Rounded 1c（标题）、Inter + Noto Sans SC（正文）

### Git 工作流

- 提交信息格式: `<type>: <description>`（feat/fix/docs/refactor）
- 不自动 push，需明确说"推送"
- 破坏性操作（reset、push --force）必须先征得同意

---

## 10. 致谢与许可证

**许可证**: [MIT](LICENSE)

**参考的开源项目**:

| 项目 | 作者 | 参考内容 |
|------|------|----------|
| [maimaidx-prober](https://github.com/diving-fish/maimaidx-prober) | Diving-Fish | Rating/B50 核心算法、API 设计 |
| [maimaiDX](https://github.com/Yuri-YuzuChaN/maimaiDX) | Yuri-YuzuChaN | API 封装、数据处理逻辑 |
| [MaimaiData](https://github.com/PaperPig/MaimaiData) | PaperPig | B50 版本判定、本地存储方案 |
| [落雪咖啡屋](https://github.com/Lxns-Network) | Lxns-Network | 枚举体系、数据模型 |

**数据来源**:
- [Diving-Fish API](https://www.diving-fish.com/maimaidx/prober/) — 曲目元数据、玩家成绩、chart_stats
- [LXNS API](https://maimai.lxns.net/)（落雪咖啡屋） — 玩家画像、曲目分类与物量数据
- [yuzuchan.moe](https://www.yuzuchan.moe/) — 社区别名

**AI 辅助开发**: Claude Code (Anthropic) + DeepSeek 模型

---

> **AI Agent 指引**: 阅读本文档后，请参考 [CLAUDE.md](CLAUDE.md) 了解工作流程规范，查看 [开发日志/](开发日志/) 了解最新进展，查阅 [docs/04-执行步骤.md](docs/04-执行步骤.md) 确认当前阶段和下一步任务。
