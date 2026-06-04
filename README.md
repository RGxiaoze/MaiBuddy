# 舞萌DX 伴侣 (maimai DX Companion)

浏览器端舞萌DX辅助工具，支持曲目检索、成绩管理、B50 分析和五维能力评估。

## 功能

- **曲目检索** — 搜索全曲库，高级筛选（定数/版本/作者），查看谱面详情和物量
- **成绩导入** — 从 Diving-Fish 一键导入全部谱面成绩到本地 IndexedDB
- **B50 分析** — 自动计算 Best 35（旧版本）+ Best 15（新版本）及总 DX Rating
- **五维评估** — 底力/体力/爆发/定位/技巧五维能力分析
- **本地优先** — 数据持久化在浏览器中，无需后端服务器

## 技术栈

React 19 + TypeScript + Vite + TailwindCSS v4 + Zustand + Dexie.js + ECharts

## 开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 生产构建
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
