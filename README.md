# 舞萌DX 伴侣 (maimai DX Companion)

浏览器端舞萌DX辅助工具，支持曲目检索、成绩管理、B50 分析和五维能力评估，全功能离线可用。

## 数据管理

- **曲目检索** — 多关键词 AND 搜索（曲名/作者/谱师/别名），高级筛选（定数预设/版本/难度），50条/页分页浏览
- **谱面详情** — 物量分布、DX Rating 对照表、全服达成分布（SSS率/SSS+率/AP率 + 同级对比 + 社区拟合定数）
- **成绩管理** — 手动录入/编辑/删除，全量成绩批量导入，[songId+levelIndex] 去重保留最高分
- **本地优先** — IndexedDB 持久化成绩 + 曲目缓存（24h TTL），无需后端服务器

## 数据分析

- **B50 分析** — Best35（旧版本）+ Best15（新版本），总 DX Rating，DX 星数展示，FC/FS 标记
- **推分建议** — 定数众数伸展区定位、水分曲加权排序（SSS+ 率 ×2）、动态合理目标达成率、B站手元一键跳转
- **推分路线** — 4 阶段定数区间规划（低/中/高/超高），全服数据驱动的动态目标调整
- **五维评估** — 底力/体力/爆发/定位/技巧立方加权评分（0-10），ECharts 雷达图可视化
- **谱面标签** — 7 种类型自动分类（交互/纵连/星星/跳拍/体力/技巧/综合），短板诊断与递进练习推荐
- **知识库策略** — 9 档定数阶梯策略文案 + 成就牌子达成条件，随 Rating 动态匹配

## 工具集成

- **Diving-Fish API** — 曲目元数据、玩家成绩查询、全服 chart_stats 统计数据
- **LXNS API**（落雪咖啡屋） — 玩家画像、曲目分类与物量数据
- **社区别名 API**（yuzuchan.moe） — 谱面常用别称索引，支持俗称搜索

## 技术栈

React 19 + TypeScript 6 + Vite 8 + TailwindCSS v4 + Zustand 5 + Dexie.js 4 + ECharts 6

## 开发

```bash
npm install
npm run dev       # 开发服务器
npm run build     # 生产构建（含知识库编译）
npm test          # 运行测试（vitest）
```

## 数据来源

本项目依赖以下社区提供的免费 API：

- [Diving-Fish API](https://www.diving-fish.com/maimaidx/prober/) — 曲目元数据、玩家成绩查询
- [LXNS API](https://maimai.lxns.net/)（落雪咖啡屋） — 玩家画像、曲目分类与物量数据

## 致谢

本项目的 Rating/B50 核心算法、五维分析体系以及 API 对接方式，参考和学习了以下开源项目的实现：

- **[Diving-Fish](https://github.com/diving-fish)** 的 [maimaidx-prober](https://github.com/diving-fish/maimaidx-prober) — 舞萌 DX 查分器，基于 Vue 2 的单页应用，是目前最广泛使用的社区查分工具。感谢 Diving-Fish 维护该 API 服务并开源代码。
- **[Yuri-YuzuChaN](https://github.com/Yuri-YuzuChaN)** 的 [maimaiDX](https://github.com/Yuri-YuzuChaN/maimaiDX) — Python 编写的 QQ Bot 查分插件，其 API 封装和数据处理逻辑为本项目的服务层设计提供了重要参考。
- **[PaperPig](https://github.com/PaperPig)** 的 [MaimaiData](https://github.com/PaperPig/MaimaiData) — Android Kotlin 应用，其 B50 版本判定逻辑和数据库设计启发了本项目的本地存储方案。
- **[落雪咖啡屋 / Lxns-Network](https://github.com/Lxns-Network)** — 国服主流查分器，提供了完善的 REST API 和玩家画像数据，其枚举体系和数据模型对本项目的类型设计有重要参考价值。

以上项目均为社区开发者无偿维护的开源工具，特此致谢。

本项目开发过程中使用了 Claude Code（Anthropic）和 DeepSeek 模型辅助编码。

## 许可

[MIT](LICENSE)
