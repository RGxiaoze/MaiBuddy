# ARCHITECTURE — 舞萌DX 伴侣

## 模块依赖图

```mermaid
graph TD
  subgraph 入口
    main[main.tsx] --> App[App.tsx]
  end

  subgraph 路由页面
    App --> SL[SongList 曲目检索]
    App --> SD[SongDetail 曲目详情]
    App --> PI[PlayerInfo B50一览]
    App --> DA[DimensionAnalysis 五维分析]
    App --> GD[Guide/Docs/Changelog]
  end

  subgraph 数据层
    SL --> sgS[songStore]
    SD --> sgS
    SD --> scS[scoreStore]
    PI --> plS[playerStore]
    PI --> scS
    DA --> scS
    DA --> plS
    sgS --> api[API 服务层]
    plS --> api
  end

  subgraph API 服务
    api --> dfAPI[divingFishApi 主数据源]
    api --> lxAPI[lxnsApi 补充源]
    api --> adapter[adapter 格式转换]
    api --> stats[statsService 全服统计]
  end

  subgraph 存储
    scS --> db[(IndexedDB Dexie)]
    sgS --> db
    stats --> db
  end

  subgraph 算法工具
    PI --> ps[pushSuggestions 推分建议]
    PI --> st[strategy 定数策略]
    PI --> b50[b50 B50计算]
    DA --> dim[dimensions 五维评分]
    DA --> wa[weaknessAnalysis 短板分析]
    DA --> rp[routePlanner 推分路线]
    b50 --> rt[rating Rating公式]
    ps --> rt
    ps --> dt[difficultyTier 难度分类]
    config[algorithms.ts] --> 算法工具
  end

  subgraph 共享组件
    layout[MainLayout/Sidebar/MobileNav]
    shared[ErrorBoundary/Pagination/SearchBar/...]
    PushSuggestions[PushSuggestions 推分面板]
    Radar[RadarChart ECharts雷达图]
  end

  PI --> PushSuggestions
  DA --> Radar
```

## 核心数据流

```
Diving-Fish API → adapter → songStore → IndexedDB 缓存
                                                 ↓
Diving-Fish API → adapter → scoreStore → IndexedDB 成绩表
                                                 ↓
                   scoreStore + songStore → b50.ts → B50 结果
                                                 ↓
              B50 + songStore → pushSuggestions.ts → 推分建议
              B50 + scores → strategy.ts → 定数策略
              scores + dimensions.ts → 五维雷达图
                                                 
统计 API → statsService → 内存缓存 → SongDetail 全服达成分布
```

## 文件职责速查

### 入口与路由
| 文件 | 职责 |
|------|------|
| `main.tsx` | React 挂载点 |
| `App.tsx` | 路由配置 + 全局初始化（别名/设置/暗色模式） |

### 页面
| 文件 | 职责 |
|------|------|
| `SongList.tsx` | 曲目检索：搜索/筛选/分页 + 导入弹窗 |
| `SongDetail.tsx` | 谱面详情：难度切换/Rating对照/成绩管理/全服达成分布 |
| `PlayerInfo.tsx` | B50一览：DF查分/本地B50/推分建议/定数策略 |
| `DimensionAnalysis.tsx` | 五维分析：雷达图/短板诊断/推分路线/策略卡片 |
| `Guide.tsx` | 使用指南（Markdown渲染） |
| `Changelog.tsx` | 更新记录（Git自动生成） |
| `Docs.tsx` | 开发文档浏览 |

### 状态管理 (Zustand)
| 文件 | 职责 |
|------|------|
| `songStore.ts` | 曲目列表 + 搜索筛选 + IndexedDB缓存（24h TTL） |
| `scoreStore.ts` | 成绩CRUD + IndexedDB同步 + 批量导入 |
| `playerStore.ts` | DF在线查分 + 本地B50计算 + 一键导入 |
| `settingsStore.ts` | 暗色模式/语言等偏好持久化 |

### API 服务
| 文件 | 职责 |
|------|------|
| `divingFishApi.ts` | DF API：曲目数据/玩家查分/成绩导入/chart_stats |
| `lxnsApi.ts` | LXNS API 桩（待实现） |
| `adapter.ts` | API原始类型 → 内部中性类型转换 |
| `statsService.ts` | chart_stats 缓存+预计算（SSS率/AP率/拟合定数等） |

### 核心算法
| 文件 | 职责 | 依赖 |
|------|------|------|
| `rating.ts` | `computeRating(定数, 达成率)` — 单曲DX Rating | constants.ts |
| `b50.ts` | `computeB50(成绩, 歌曲)` — B35旧+B15新，降序排列 | rating.ts |
| `pushSuggestions.ts` | 推分候选池：扫描曲库→众数区间→三档目标→排序 | rating.ts, difficultyTier.ts |
| `difficultyTier.ts` | 推分难度分类 + 合理目标达成率 | config |
| `strategy.ts` | 9档定数阶梯策略（入门→理论上限） | b50.ts |
| `dimensions.ts` | 五维评分（底力/体力/爆发/定位/技巧） | config |
| `weaknessAnalysis.ts` | 短板诊断（按标签分组→chart_stats基准→定数分层） | chartTags.ts |
| `routePlanner.ts` | 推分路线规划（4阶段定数递进） | pushSuggestions.ts |
| `dxStar.ts` | DX星数计算（97/95/93/90/85%→⭐1-5） | — |
| `chartTags.ts` | 谱面标签分类（交互/纵连/星星/跳拍/体力/技巧/综合） | — |

### 配置
| 文件 | 职责 |
|------|------|
| `config/algorithms.ts` | 60+业务常量：B50大小/定数分段/五维归一化/推分阈值 |
| `data/constants.ts` | UI常量：难度颜色/评级标签/系数表 |
| `data/versions.ts` | 版本分组（国服/日服）+版本排序映射 |
| `data/aliases.ts` | 社区别名加载+反向索引+子串搜索 |

### 存储
| 文件 | 职责 |
|------|------|
| `db/database.ts` | Dexie v4：scores/songCache/aliasCache/statsCache/settings |

### 共享组件
| 文件 | 职责 |
|------|------|
| `ErrorBoundary.tsx` | 渲染错误捕获 + 回退UI |
| `PushSuggestions.tsx` | 推分建议表格（B35+B15双池） |
| `RadarChart.tsx` | ECharts五维雷达图 |
| `Pagination.tsx` | 50条/页分页导航 |
| `ScoreForm.tsx` | 成绩录入/编辑模态框 |
| `SearchBar.tsx` | 搜索输入框 |
| `DifficultyBadge/GradeBadge` | 难度/评级标签 |
| `LoadingSpinner/EmptyState/ErrorMessage` | 状态组件 |

## 配置常量速查

| 常量 | 位置 | 含义 | 改后影响 |
|------|------|------|---------|
| `COEFFICIENT_TABLE` | constants.ts | 24阈值达成率→等级系数 | Rating计算结果 |
| `MAX_SUGGESTIONS_PER_POOL` | algorithms.ts | 推分建议每池上限(30) | 展示条数 |
| `B35_MODE_MIN_COUNT` | algorithms.ts | 众数计算最少样本(5) | 推分区间宽度 |
| `SKIP_LOW_LEVEL` / `SKIP_LOW_ACH` | algorithms.ts | 过滤低定数低达成噪音 | 建议质量 |
| `NORM_MAX` | algorithms.ts | 五维各维度归一化上限 | 雷达图范围 |
| `LEVEL_TIER_*` | algorithms.ts | 定数区间分段阈值 | 策略卡片归类 |
| `SONG_CACHE_TTL_MS` | database.ts | 曲目缓存有效期(24h) | 刷新频率 |
| `VERSION_ORDER` | versions.ts | 版本排序映射表 | 曲目列表排序 |

## 常见修改场景

### 调整推分建议的定数区间
1. 修改 `algorithms.ts` 中的 `STRETCH_UPPER`/`STRETCH_LOWER` 相关常量
2. 实际逻辑在 `pushSuggestions.ts` → `computeLevelMode()` 后
3. 运行 `npm test` 确认 `rating.test.ts` 通过

### 增加新的推分目标档位
1. `pushSuggestions.ts` → `TARGET_LEVELS` 数组
2. `PushSuggestions.tsx` → 表头 + `PushRow` 列渲染

### 修改五维某个维度的计算公式
1. `dimensions.ts` → `computeChartDimensions()` 或 `dimensionScorer.ts`
2. 修改后运行 `calibrateNormMax(songs)` 重新校准 `NORM_MAX`

### 新增 API 数据源
1. `services/` 新建 API 文件
2. `adapter.ts` 新增格式转换函数
3. `types/index.ts` 同步类型（保持内部中性命名）

### 新增页面
1. `pages/` 新建页面组件
2. `App.tsx` 注册路由 + lazy import
3. `Sidebar.tsx` + `MobileBottomNav.tsx` 添加导航项
